/**
 * One-time migration: dump the local better-sqlite3 database into Turso (libSQL).
 *
 * Usage:
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... bun run migrate:turso
 *   # optional: SRC_DB=path/to/other.db
 *
 * Idempotent: skills/skill_files/categories use ON CONFLICT; sync_log is wiped
 * and re-inserted (it has no business unique key).
 */
import Database from "better-sqlite3";
import { getClient } from "../src/lib/db";

const SRC = process.env.SRC_DB || "data/skill-hub.db";
const BATCH = 50;

async function main() {
  const local = new Database(SRC, { readonly: true });

  // 1) Target schema (creates tables + seeds default categories).
  const turso = await getClient();

  // 2) Read source rows.
  const skills = local
    .prepare(
      "SELECT slug, name, description, version, agent, triggers, created_at, updated_at, checksum, category FROM skills"
    )
    .all() as Array<{
    slug: string;
    name: string;
    description: string;
    version: string;
    agent: string;
    triggers: string;
    created_at: string;
    updated_at: string;
    checksum: string;
    category: string | null;
  }>;

  const files = local
    .prepare("SELECT skill_slug, filename, content, updated_at FROM skill_files")
    .all() as Array<{ skill_slug: string; filename: string; content: string; updated_at: string }>;

  const logs = local
    .prepare("SELECT skill_slug, action, timestamp, device_id FROM sync_log")
    .all() as Array<{ skill_slug: string; action: string; timestamp: string; device_id: string | null }>;

  const cats = local
    .prepare("SELECT name, sort_order FROM categories")
    .all() as Array<{ name: string; sort_order: number }>;

  // 3) sync_log: wipe first for idempotency.
  await turso.execute("DELETE FROM sync_log");

  // 4) skills (idempotent upsert).
  for (let i = 0; i < skills.length; i += BATCH) {
    await turso.batch(
      skills.slice(i, i + BATCH).map((s) => ({
        sql: `INSERT INTO skills (slug, name, description, version, agent, triggers, created_at, updated_at, checksum, category)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(slug) DO UPDATE SET
                name=excluded.name, description=excluded.description, version=excluded.version,
                agent=excluded.agent, triggers=excluded.triggers, created_at=excluded.created_at,
                updated_at=excluded.updated_at, checksum=excluded.checksum, category=excluded.category`,
        args: [s.slug, s.name, s.description, s.version, s.agent, s.triggers, s.created_at, s.updated_at, s.checksum, s.category ?? null],
      })),
      "write"
    );
  }

  // 5) skill_files — content may be large, insert one at a time.
  for (const f of files) {
    await turso.execute({
      sql: `INSERT INTO skill_files (skill_slug, filename, content, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(skill_slug, filename) DO UPDATE SET
              content=excluded.content, updated_at=excluded.updated_at`,
      args: [f.skill_slug, f.filename, f.content, f.updated_at],
    });
  }

  // 6) sync_log.
  for (let i = 0; i < logs.length; i += BATCH) {
    await turso.batch(
      logs.slice(i, i + BATCH).map((l) => ({
        sql: "INSERT INTO sync_log (skill_slug, action, timestamp, device_id) VALUES (?, ?, ?, ?)",
        args: [l.skill_slug, l.action, l.timestamp, l.device_id ?? null],
      })),
      "write"
    );
  }

  // 7) categories — preserve custom ones; default seed already present.
  for (const c of cats) {
    await turso.execute({
      sql: "INSERT INTO categories (name, sort_order) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET sort_order=excluded.sort_order",
      args: [c.name, Number(c.sort_order)],
    });
  }

  console.log(
    `✅ migrated: ${skills.length} skills, ${files.length} files, ${logs.length} logs, ${cats.length} categories`
  );
  local.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ migration failed:", e);
  process.exit(1);
});
