import { createHash } from "crypto";
import { getClient } from "./db";
import type { InArgs } from "@libsql/client";
import { buildInstallCmd } from "./github";
import type {
  SkillMeta,
  SkillDetail,
  SkillRegistry,
  CreateSkillInput,
  AgentType,
  SkillFile,
} from "./types";

// --- Internal query helpers (thin wrappers over libSQL execute) ---

async function one<T = Record<string, unknown>>(
  sql: string,
  args: InArgs = []
): Promise<T | undefined> {
  const client = await getClient();
  const { rows } = await client.execute({ sql, args });
  return rows[0] as unknown as T | undefined;
}

async function many<T = Record<string, unknown>>(
  sql: string,
  args: InArgs = []
): Promise<T[]> {
  const client = await getClient();
  const { rows } = await client.execute({ sql, args });
  return rows as unknown as T[];
}

// --- Skill markdown builder ---

function buildSkillMd(input: CreateSkillInput): string {
  const triggerLines = input.triggers?.length
    ? `\nread_when:\n${input.triggers.map((t) => `  - ${t}`).join("\n")}`
    : "";

  return `---
name: ${input.name}
description: "${input.description}"${triggerLines}
---

${input.content}`;
}

// --- Checksum ---

export function computeChecksum(files: SkillFile[]): string {
  const content = files
    .map((f) => `${f.filename}:${f.content}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

// --- CRUD ---

type SkillListRow = {
  slug: string;
  name: string;
  description: string;
  version: string;
  agent: string;
  triggers: string;
  updated_at: string;
  category: string | null;
  files: string | null;
};

function toSkillMeta(row: SkillListRow): SkillMeta {
  return {
    name: row.name,
    slug: row.slug,
    description: row.description,
    version: row.version || undefined,
    agent: row.agent as AgentType,
    triggers: row.triggers ? JSON.parse(row.triggers) : undefined,
    path: `skills/${row.slug}`,
    updatedAt: row.updated_at,
    files: row.files ? row.files.split(",") : [],
    category: row.category || undefined,
  };
}

const LIST_SELECT = `
  SELECT s.slug, s.name, s.description, s.version, s.agent, s.triggers, s.updated_at, s.category,
         GROUP_CONCAT(sf.filename, ',') as files
  FROM skills s
  LEFT JOIN skill_files sf ON s.slug = sf.skill_slug
`;

export async function listSkills(): Promise<SkillMeta[]> {
  const rows = await many<SkillListRow>(
    `${LIST_SELECT} GROUP BY s.slug ORDER BY s.updated_at DESC`
  );
  return rows.map(toSkillMeta);
}

export async function getSkillRegistry(): Promise<SkillRegistry> {
  const skills = await listSkills();
  return {
    skills,
    updatedAt: skills[0]?.updatedAt || new Date().toISOString(),
  };
}

export async function getSkillDetail(slug: string): Promise<SkillDetail | null> {
  const skill = await one<Record<string, unknown>>(
    "SELECT * FROM skills WHERE slug = ?",
    [slug]
  );
  if (!skill) return null;

  const files = await many<{ filename: string; content: string }>(
    "SELECT filename, content FROM skill_files WHERE skill_slug = ?",
    [slug]
  );

  const skillMd = files.find((f) => f.filename === "SKILL.md");
  const content = skillMd?.content || "";
  const agent = (skill.agent as AgentType) || "claude";

  return {
    name: skill.name as string,
    slug: skill.slug as string,
    description: skill.description as string,
    version: (skill.version as string) || undefined,
    agent,
    triggers: skill.triggers ? JSON.parse(skill.triggers as string) : undefined,
    path: `skills/${slug}`,
    updatedAt: skill.updated_at as string,
    category: (skill.category as string) || undefined,
    files: files.map((f) => f.filename),
    content,
    installCmd: buildInstallCmd(agent, slug),
  };
}

const UPSERT_SKILL_SQL = `
  INSERT INTO skills (slug, name, description, version, agent, triggers, updated_at, checksum)
  VALUES (?, ?, ?, '1.0.0', ?, ?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET
    name = excluded.name,
    description = excluded.description,
    agent = excluded.agent,
    triggers = excluded.triggers,
    updated_at = excluded.updated_at,
    checksum = excluded.checksum
`;

const UPSERT_FILE_SQL = `
  INSERT INTO skill_files (skill_slug, filename, content, updated_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(skill_slug, filename) DO UPDATE SET
    content = excluded.content,
    updated_at = excluded.updated_at
`;

export async function upsertSkill(input: CreateSkillInput): Promise<{ slug: string }> {
  const client = await getClient();
  const { slug, name, description, triggers, agent } = input;

  const skillMd = buildSkillMd(input);
  const files: SkillFile[] = [{ filename: "SKILL.md", content: skillMd }];
  const checksum = computeChecksum(files);
  const now = new Date().toISOString().replace("T", " ").replace("Z", "");
  const triggersJson = JSON.stringify(triggers || []);

  const exists = await one("SELECT 1 FROM skills WHERE slug = ?", [slug]);
  const action = exists ? "update" : "create";

  await client.batch(
    [
      { sql: UPSERT_SKILL_SQL, args: [slug, name, description, agent, triggersJson, now, checksum] },
      { sql: UPSERT_FILE_SQL, args: [slug, "SKILL.md", skillMd, now] },
      { sql: "INSERT INTO sync_log (skill_slug, action, timestamp) VALUES (?, ?, ?)", args: [slug, action, now] },
    ],
    "write"
  );

  return { slug };
}

export async function deleteSkill(slug: string): Promise<void> {
  const client = await getClient();
  const now = new Date().toISOString().replace("T", " ").replace("Z", "");

  await client.batch(
    [
      { sql: "DELETE FROM skill_files WHERE skill_slug = ?", args: [slug] },
      { sql: "DELETE FROM skills WHERE slug = ?", args: [slug] },
      { sql: "INSERT INTO sync_log (skill_slug, action, timestamp) VALUES (?, 'delete', ?)", args: [slug, now] },
    ],
    "write"
  );
}

/** Upsert multiple files for a skill (used by sync push / imports). */
export async function upsertSkillFiles(
  slug: string,
  name: string,
  description: string,
  agent: AgentType,
  triggers: string[],
  files: SkillFile[]
): Promise<{ slug: string; checksum: string }> {
  const client = await getClient();
  const checksum = computeChecksum(files);
  const now = new Date().toISOString().replace("T", " ").replace("Z", "");
  const triggersJson = JSON.stringify(triggers || []);

  const exists = await one("SELECT 1 FROM skills WHERE slug = ?", [slug]);
  const action = exists ? "update" : "create";

  const stmts: Array<{ sql: string; args: InArgs }> = [
    { sql: UPSERT_SKILL_SQL, args: [slug, name, description, agent, triggersJson, now, checksum] },
  ];

  for (const file of files) {
    stmts.push({ sql: UPSERT_FILE_SQL, args: [slug, file.filename, file.content, now] });
  }

  // Remove files that no longer exist in this upload (flat <-> nested re-sync).
  if (files.length > 0) {
    const placeholders = files.map(() => "?").join(",");
    stmts.push({
      sql: `DELETE FROM skill_files WHERE skill_slug = ? AND filename NOT IN (${placeholders})`,
      args: [slug, ...files.map((f) => f.filename)],
    });
  }

  stmts.push({
    sql: "INSERT INTO sync_log (skill_slug, action, timestamp) VALUES (?, ?, ?)",
    args: [slug, action, now],
  });

  await client.batch(stmts, "write");

  return { slug, checksum };
}

/** Get the current checksum of a skill. */
export async function getSkillChecksum(slug: string): Promise<string | null> {
  const row = await one<{ checksum: string }>(
    "SELECT checksum FROM skills WHERE slug = ?",
    [slug]
  );
  return row?.checksum ?? null;
}

/** Get sync log entries since a timestamp. */
export async function getSyncLogSince(
  since?: string
): Promise<Array<{ skill_slug: string; action: string; timestamp: string }>> {
  if (!since) {
    return many<{ skill_slug: string; action: string; timestamp: string }>(
      "SELECT skill_slug, action, timestamp FROM sync_log ORDER BY timestamp ASC"
    );
  }
  return many<{ skill_slug: string; action: string; timestamp: string }>(
    "SELECT skill_slug, action, timestamp FROM sync_log WHERE timestamp > ? ORDER BY timestamp ASC",
    [since]
  );
}

/** Update category for a single skill (pass null to clear). Returns rows affected (0 = slug not found). */
export async function updateSkillCategory(
  slug: string,
  category: string | null
): Promise<number> {
  const client = await getClient();
  const result = await client.execute({
    sql: "UPDATE skills SET category = ? WHERE slug = ?",
    args: [category, slug],
  });
  return result.rowsAffected;
}

/** List skills that have no category set. */
export async function listUncategorizedSkills(): Promise<SkillMeta[]> {
  const rows = await many<SkillListRow>(
    `${LIST_SELECT} WHERE s.category IS NULL GROUP BY s.slug ORDER BY s.updated_at DESC`
  );
  return rows.map(toSkillMeta);
}

/** Batch update categories for multiple skills. */
export async function batchUpdateCategories(
  categories: Record<string, string>
): Promise<number> {
  const client = await getClient();
  const entries = Object.entries(categories);
  if (entries.length === 0) return 0;

  const results = await client.batch(
    entries.map(([slug, category]) => ({
      sql: "UPDATE skills SET category = ? WHERE slug = ?",
      args: [category, slug],
    })),
    "write"
  );
  return results.reduce((n, r) => n + (r.rowsAffected ?? 0), 0);
}

/** Get files for a skill. */
export async function getSkillFiles(slug: string): Promise<SkillFile[]> {
  return many<SkillFile>(
    "SELECT filename, content FROM skill_files WHERE skill_slug = ?",
    [slug]
  );
}

/** Check if database has any skills. */
export async function hasSkills(): Promise<boolean> {
  const row = await one<{ count: number }>("SELECT COUNT(*) as count FROM skills");
  return Number(row?.count ?? 0) > 0;
}

// --- Category CRUD ---

export interface CategoryRow {
  name: string;
  sort_order: number;
}

export async function listCategories(): Promise<CategoryRow[]> {
  const rows = await many<{ name: string; sort_order: number }>(
    "SELECT name, sort_order FROM categories ORDER BY sort_order ASC"
  );
  return rows.map((r) => ({ name: r.name, sort_order: Number(r.sort_order) }));
}

export async function createCategory(name: string, sortOrder?: number): Promise<void> {
  const client = await getClient();
  if (sortOrder === undefined) {
    const max = await one<{ m: number | null }>(
      "SELECT MAX(sort_order) as m FROM categories"
    );
    sortOrder = (Number(max?.m ?? -1)) + 1;
  }
  await client.execute({
    sql: "INSERT INTO categories (name, sort_order) VALUES (?, ?)",
    args: [name, sortOrder],
  });
}

export async function updateCategory(oldName: string, newName: string): Promise<number> {
  const client = await getClient();
  const results = await client.batch(
    [
      { sql: "UPDATE categories SET name = ? WHERE name = ?", args: [newName, oldName] },
      { sql: "UPDATE skills SET category = ? WHERE category = ?", args: [newName, oldName] },
    ],
    "write"
  );
  return results[0].rowsAffected ?? 0;
}

export async function deleteCategory(name: string): Promise<number> {
  const client = await getClient();
  const results = await client.batch(
    [
      { sql: "UPDATE skills SET category = NULL WHERE category = ?", args: [name] },
      { sql: "DELETE FROM categories WHERE name = ?", args: [name] },
    ],
    "write"
  );
  return results[1].rowsAffected ?? 0;
}
