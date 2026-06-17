import { getClient } from "./db";
import {
  upsertSkillFiles,
  getSkillFiles,
  getSkillChecksum,
  listSkills,
} from "./storage";
import type { SyncPushRequest, SyncPullResponse, SyncChange, SyncStatusResponse } from "./types";

/** Handle a push request from CLI */
export async function handlePush(data: SyncPushRequest): Promise<{
  ok: boolean;
  slug: string;
  checksum: string;
  conflict?: boolean;
}> {
  const { slug, files, base_checksum } = data;

  // Conflict detection: if base_checksum provided, check against current
  if (base_checksum) {
    const currentChecksum = await getSkillChecksum(slug);
    if (currentChecksum && currentChecksum !== base_checksum) {
      return {
        ok: false,
        slug,
        checksum: currentChecksum,
        conflict: true,
      };
    }
  }

  // Extract metadata from SKILL.md
  const skillMd = files.find((f) => f.filename === "SKILL.md");
  if (!skillMd) {
    throw new Error("SKILL.md is required");
  }

  // Parse frontmatter for metadata
  const fm = parseFrontmatterContent(skillMd.content);

  const result = await upsertSkillFiles(
    slug,
    fm.name || slug,
    fm.description || "",
    "claude",
    fm.triggers || [],
    files
  );

  return {
    ok: true,
    slug: result.slug,
    checksum: result.checksum,
  };
}

/** Handle a pull request from CLI */
export async function handlePull(since?: string): Promise<SyncPullResponse> {
  if (!since) {
    // Full pull: return all skills
    const skills = await listSkills();
    const changes = await Promise.all(
      skills.map(async (skill) => {
        const files = await getSkillFiles(skill.slug);
        const checksum = (await getSkillChecksum(skill.slug)) || "";
        return {
          slug: skill.slug,
          action: "create" as const,
          files,
          checksum,
          timestamp: skill.updatedAt,
        };
      })
    );

    return {
      changes,
      server_time: new Date().toISOString(),
    };
  }

  // Incremental pull: get changes from sync_log since timestamp
  const client = await getClient();
  const { rows } = await client.execute({
    sql: `SELECT DISTINCT skill_slug, action, MAX(timestamp) as timestamp
          FROM sync_log WHERE timestamp > ? GROUP BY skill_slug ORDER BY timestamp ASC`,
    args: [since],
  });
  const logs = rows as unknown as Array<{ skill_slug: string; action: string; timestamp: string }>;

  const changes: SyncChange[] = [];

  for (const log of logs) {
    if (log.action === "delete") {
      changes.push({
        slug: log.skill_slug,
        action: "delete",
        files: [],
        checksum: "",
        timestamp: log.timestamp,
      });
    } else {
      const files = await getSkillFiles(log.skill_slug);
      const checksum = (await getSkillChecksum(log.skill_slug)) || "";
      changes.push({
        slug: log.skill_slug,
        action: log.action as "create" | "update",
        files,
        checksum,
        timestamp: log.timestamp,
      });
    }
  }

  return {
    changes,
    server_time: new Date().toISOString(),
  };
}

/** Get server sync status */
export async function getSyncStatus(): Promise<SyncStatusResponse> {
  const client = await getClient();
  const skillRes = await client.execute("SELECT COUNT(*) as count FROM skills");
  const lastRes = await client.execute("SELECT MAX(updated_at) as last FROM skills");
  const skillRow = skillRes.rows[0] as unknown as { count?: number } | undefined;
  const lastRow = lastRes.rows[0] as unknown as { last?: string | null } | undefined;

  return {
    skill_count: Number(skillRow?.count ?? 0),
    last_modified: lastRow?.last ?? null,
    server_time: new Date().toISOString(),
  };
}

// --- Internal helpers ---

function parseFrontmatterContent(content: string): {
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
