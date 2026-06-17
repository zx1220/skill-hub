import { createClient, type Client } from "@libsql/client";

// libSQL (Turso) client. Pure-JS, serverless friendly.
// - Production: TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (remote Turso DB)
// - Local dev fallback: file:./data/local.db

let clientPromise: Promise<Client> | null = null;

const SCHEMA_STMTS = [
  `CREATE TABLE IF NOT EXISTS skills (
    slug        TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    version     TEXT NOT NULL DEFAULT '1.0.0',
    agent       TEXT NOT NULL DEFAULT 'claude',
    triggers    TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    checksum    TEXT NOT NULL DEFAULT '',
    category    TEXT DEFAULT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS skill_files (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_slug  TEXT NOT NULL REFERENCES skills(slug) ON DELETE CASCADE,
    filename    TEXT NOT NULL,
    content     TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(skill_slug, filename)
  )`,
  `CREATE TABLE IF NOT EXISTS sync_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_slug  TEXT NOT NULL,
    action      TEXT NOT NULL,
    timestamp   TEXT NOT NULL DEFAULT (datetime('now')),
    device_id   TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    name       TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sync_log_timestamp ON sync_log(timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_skill_files_slug ON skill_files(skill_slug)`,
];

const DEFAULT_CATEGORIES = [
  "工作流引擎",
  "后端开发",
  "前端开发",
  "内容创作",
  "工具类",
  "咨询获取类",
];

/**
 * Get the libSQL client singleton, initializing schema + default categories on
 * first connect. Module-level Promise cache avoids concurrent first-call races
 * and lets warm serverless instances reuse the connection.
 */
export function getClient(): Promise<Client> {
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    const url = process.env.TURSO_DATABASE_URL || process.env.SKILL_DB_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    const client = createClient(
      url ? { url, authToken } : { url: "file:./data/local.db" }
    );

    // Full schema (idempotent). `category` column + `categories` table are
    // baked in — no runtime migration needed for fresh Turso/local databases.
    await client.batch(SCHEMA_STMTS.map((sql) => ({ sql })));

    // Seed default categories only when the table is empty.
    const { rows } = await client.execute("SELECT COUNT(*) as c FROM categories");
    if (Number((rows[0] as unknown as { c?: number }).c ?? 0) === 0) {
      await client.batch(
        DEFAULT_CATEGORIES.map((name, i) => ({
          sql: "INSERT INTO categories (name, sort_order) VALUES (?, ?)",
          args: [name, i],
        })),
        "write"
      );
    }

    console.log(`[skill-hub] Database ready (${url ? "remote Turso" : "local file"})`);
    return client;
  })().catch((e) => {
    // Reset so a later call can retry after a transient failure.
    clientPromise = null;
    throw e;
  });

  return clientPromise;
}
