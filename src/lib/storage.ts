import { mkdirSync, rmSync, writeFileSync, readdirSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";
import { getDb } from "./db";
import { DB_CONFIG } from "./constants";
import { buildInstallCmd } from "./github";
import type {
  SkillMeta,
  SkillDetail,
  SkillRegistry,
  CreateSkillInput,
  AgentType,
  SkillFile,
} from "./types";

// --- Skill directory on filesystem ---

function skillDir(slug: string): string {
  return join(DB_CONFIG.dataDir, slug);
}

function ensureSkillDir(slug: string): void {
  const dir = skillDir(slug);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// --- Frontmatter parser (reused from github.ts pattern) ---

function parseFrontmatter(content: string): {
  name: string;
  description: string;
  triggers?: string[];
  version?: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { name: "", description: "" };

  const fm = match[1];
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const descMatch = fm.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  const readWhenMatch = fm.match(/^read_when:\s*\n((?:\s*-\s*.+\n?)+)/m);
  const versionMatch = fm.match(/^version:\s*["']?(.+?)["']?\s*$/m);

  let triggers: string[] | undefined;
  if (readWhenMatch) {
    triggers = readWhenMatch[1]
      .split("\n")
      .map((l) => l.replace(/^\s*-\s*/, "").trim())
      .filter(Boolean);
  }

  return {
    name: nameMatch?.[1]?.trim() || "",
    description: descMatch?.[1]?.trim() || "",
    triggers,
    version: versionMatch?.[1]?.trim(),
  };
}

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

export function listSkills(): SkillMeta[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.slug, s.name, s.description, s.version, s.agent, s.triggers, s.updated_at, s.category,
              GROUP_CONCAT(sf.filename, ',') as files
       FROM skills s
       LEFT JOIN skill_files sf ON s.slug = sf.skill_slug
       GROUP BY s.slug
       ORDER BY s.updated_at DESC`
    )
    .all() as Array<{
    slug: string;
    name: string;
    description: string;
    version: string;
    agent: string;
    triggers: string;
    updated_at: string;
    category: string | null;
    files: string | null;
  }>;

  return rows.map((row) => ({
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
  }));
}

export function getSkillRegistry(): SkillRegistry {
  const skills = listSkills();
  return {
    skills,
    updatedAt: skills[0]?.updatedAt || new Date().toISOString(),
  };
}

export function getSkillDetail(slug: string): SkillDetail | null {
  const db = getDb();

  const skill = db
    .prepare("SELECT * FROM skills WHERE slug = ?")
    .get(slug) as Record<string, unknown> | undefined;

  if (!skill) return null;

  const files = db
    .prepare("SELECT filename, content FROM skill_files WHERE skill_slug = ?")
    .all(slug) as Array<{ filename: string; content: string }>;

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
    files: files.map((f) => f.filename),
    content,
    installCmd: buildInstallCmd(agent, slug),
  };
}

export function upsertSkill(input: CreateSkillInput): { slug: string } {
  const db = getDb();
  const { slug, name, description, triggers, agent } = input;

  const skillMd = buildSkillMd(input);
  const files: SkillFile[] = [{ filename: "SKILL.md", content: skillMd }];
  const checksum = computeChecksum(files);
  const now = new Date().toISOString().replace("T", " ").replace("Z", "");
  const triggersJson = JSON.stringify(triggers || []);

  // Upsert into database (transaction)
  const upsertSkillStmt = db.prepare(`
    INSERT INTO skills (slug, name, description, version, agent, triggers, updated_at, checksum)
    VALUES (?, ?, ?, '1.0.0', ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      agent = excluded.agent,
      triggers = excluded.triggers,
      updated_at = excluded.updated_at,
      checksum = excluded.checksum
  `);

  const upsertFileStmt = db.prepare(`
    INSERT INTO skill_files (skill_slug, filename, content, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(skill_slug, filename) DO UPDATE SET
      content = excluded.content,
      updated_at = excluded.updated_at
  `);

  const logSyncStmt = db.prepare(`
    INSERT INTO sync_log (skill_slug, action, timestamp)
    VALUES (?, ?, ?)
  `);

  const action = db.prepare("SELECT 1 FROM skills WHERE slug = ?").get(slug) ? "update" : "create";

  const transaction = db.transaction(() => {
    upsertSkillStmt.run(slug, name, description, agent, triggersJson, now, checksum);
    upsertFileStmt.run(slug, "SKILL.md", skillMd, now);
    logSyncStmt.run(slug, action, now);
  });

  transaction();

  // Write to filesystem
  ensureSkillDir(slug);
  writeFileSync(join(skillDir(slug), "SKILL.md"), skillMd, "utf-8");

  return { slug };
}

export function deleteSkill(slug: string): void {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace("Z", "");

  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM skill_files WHERE skill_slug = ?").run(slug);
    db.prepare("DELETE FROM skills WHERE slug = ?").run(slug);
    db.prepare("INSERT INTO sync_log (skill_slug, action, timestamp) VALUES (?, 'delete', ?)").run(slug, now);
  });

  transaction();

  // Remove filesystem directory
  const dir = skillDir(slug);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Upsert multiple files for a skill (used by sync push) */
export function upsertSkillFiles(
  slug: string,
  name: string,
  description: string,
  agent: AgentType,
  triggers: string[],
  files: SkillFile[]
): { slug: string; checksum: string } {
  const db = getDb();
  const checksum = computeChecksum(files);
  const now = new Date().toISOString().replace("T", " ").replace("Z", "");
  const triggersJson = JSON.stringify(triggers || []);

  const upsertSkillStmt = db.prepare(`
    INSERT INTO skills (slug, name, description, version, agent, triggers, updated_at, checksum)
    VALUES (?, ?, ?, '1.0.0', ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      agent = excluded.agent,
      triggers = excluded.triggers,
      updated_at = excluded.updated_at,
      checksum = excluded.checksum
  `);

  const upsertFileStmt = db.prepare(`
    INSERT INTO skill_files (skill_slug, filename, content, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(skill_slug, filename) DO UPDATE SET
      content = excluded.content,
      updated_at = excluded.updated_at
  `);

  const deleteFileStmt = db.prepare(`
    DELETE FROM skill_files WHERE skill_slug = ? AND filename NOT IN (${files.map(() => "?").join(",")})
  `);

  const logSyncStmt = db.prepare(`
    INSERT INTO sync_log (skill_slug, action, timestamp) VALUES (?, ?, ?)
  `);

  const action = db.prepare("SELECT 1 FROM skills WHERE slug = ?").get(slug) ? "update" : "create";

  const transaction = db.transaction(() => {
    upsertSkillStmt.run(slug, name, description, agent, triggersJson, now, checksum);
    for (const file of files) {
      upsertFileStmt.run(slug, file.filename, file.content, now);
    }
    // Remove files that no longer exist
    if (files.length > 0) {
      deleteFileStmt.run(slug, ...files.map((f) => f.filename));
    }
    logSyncStmt.run(slug, action, now);
  });

  transaction();

  // Sync to filesystem
  ensureSkillDir(slug);
  // Remove old files not in the new set
  const existingFiles = readdirSync(skillDir(slug));
  const newFilenames = new Set(files.map((f) => f.filename));
  for (const ef of existingFiles) {
    if (!newFilenames.has(ef)) {
      rmSync(join(skillDir(slug), ef), { force: true });
    }
  }
  // Write new files (ensure subdirectories exist)
  for (const file of files) {
    const filePath = join(skillDir(slug), file.filename);
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, file.content, "utf-8");
  }

  return { slug, checksum };
}

/** Get the current checksum of a skill */
export function getSkillChecksum(slug: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT checksum FROM skills WHERE slug = ?").get(slug) as { checksum: string } | undefined;
  return row?.checksum ?? null;
}

/** Get sync log entries since a timestamp */
export function getSyncLogSince(since?: string): Array<{
  skill_slug: string;
  action: string;
  timestamp: string;
}> {
  const db = getDb();
  if (!since) {
    return db.prepare("SELECT skill_slug, action, timestamp FROM sync_log ORDER BY timestamp ASC").all() as Array<{
      skill_slug: string;
      action: string;
      timestamp: string;
    }>;
  }
  return db.prepare("SELECT skill_slug, action, timestamp FROM sync_log WHERE timestamp > ? ORDER BY timestamp ASC").all(since) as Array<{
    skill_slug: string;
    action: string;
    timestamp: string;
  }>;
}

/** Update category for a single skill (pass null to clear) */
export function updateSkillCategory(slug: string, category: string | null): void {
  const db = getDb();
  db.prepare("UPDATE skills SET category = ? WHERE slug = ?").run(category, slug);
}

/** List skills that have no category set */
export function listUncategorizedSkills(): SkillMeta[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.slug, s.name, s.description, s.version, s.agent, s.triggers, s.updated_at, s.category,
              GROUP_CONCAT(sf.filename, ',') as files
       FROM skills s
       LEFT JOIN skill_files sf ON s.slug = sf.skill_slug
       WHERE s.category IS NULL
       GROUP BY s.slug
       ORDER BY s.updated_at DESC`
    )
    .all() as Array<{
    slug: string;
    name: string;
    description: string;
    version: string;
    agent: string;
    triggers: string;
    updated_at: string;
    category: string | null;
    files: string | null;
  }>;

  return rows.map((row) => ({
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
  }));
}

/** Batch update categories for multiple skills */
export function batchUpdateCategories(categories: Record<string, string>): number {
  const db = getDb();
  const stmt = db.prepare("UPDATE skills SET category = ? WHERE slug = ?");
  const transaction = db.transaction(() => {
    let count = 0;
    for (const [slug, category] of Object.entries(categories)) {
      const result = stmt.run(category, slug);
      if (result.changes > 0) count++;
    }
    return count;
  });
  return transaction();
}

/** Get files for a skill */
export function getSkillFiles(slug: string): SkillFile[] {
  const db = getDb();
  return db.prepare("SELECT filename, content FROM skill_files WHERE skill_slug = ?").all(slug) as SkillFile[];
}

/** Check if database has any skills */
export function hasSkills(): boolean {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM skills").get() as { count: number };
  return row.count > 0;
}

// --- Category CRUD ---

export interface CategoryRow {
  name: string;
  sort_order: number;
}

export function listCategories(): CategoryRow[] {
  const db = getDb();
  return db.prepare("SELECT name, sort_order FROM categories ORDER BY sort_order ASC").all() as CategoryRow[];
}

export function createCategory(name: string, sortOrder?: number): void {
  const db = getDb();
  if (sortOrder === undefined) {
    const max = db.prepare("SELECT MAX(sort_order) as m FROM categories").get() as { m: number | null };
    sortOrder = (max.m ?? -1) + 1;
  }
  db.prepare("INSERT INTO categories (name, sort_order) VALUES (?, ?)").run(name, sortOrder);
}

export function updateCategory(oldName: string, newName: string): number {
  const db = getDb();
  const tx = db.transaction(() => {
    const r = db.prepare("UPDATE categories SET name = ? WHERE name = ?").run(newName, oldName);
    db.prepare("UPDATE skills SET category = ? WHERE category = ?").run(newName, oldName);
    return r.changes;
  });
  return tx();
}

export function deleteCategory(name: string): number {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("UPDATE skills SET category = NULL WHERE category = ?").run(name);
    const r = db.prepare("DELETE FROM categories WHERE name = ?").run(name);
    return r.changes;
  });
  return tx();
}
