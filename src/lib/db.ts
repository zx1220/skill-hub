import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { DB_CONFIG } from "./constants";

let db: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS skills (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  version     TEXT NOT NULL DEFAULT '1.0.0',
  agent       TEXT NOT NULL DEFAULT 'claude',
  triggers    TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  checksum    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS skill_files (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_slug  TEXT NOT NULL REFERENCES skills(slug) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  content     TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(skill_slug, filename)
);

CREATE TABLE IF NOT EXISTS sync_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_slug  TEXT NOT NULL,
  action      TEXT NOT NULL,
  timestamp   TEXT NOT NULL DEFAULT (datetime('now')),
  device_id   TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_log_timestamp ON sync_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_skill_files_slug ON skill_files(skill_slug);
`;

export function getDb(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  const dataDir = dirname(DB_CONFIG.dbPath);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Ensure skills storage directory exists
  if (!existsSync(DB_CONFIG.dataDir)) {
    mkdirSync(DB_CONFIG.dataDir, { recursive: true });
  }

  db = new Database(DB_CONFIG.dbPath);

  // WAL mode for better concurrent read performance
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Initialize schema
  db.exec(SCHEMA);

  // Migrations: add category column if missing
  const cols = db.pragma("table_info(skills)") as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "category")) {
    db.exec("ALTER TABLE skills ADD COLUMN category TEXT DEFAULT NULL");
  }

  // Migration: add categories table if missing
  const catCols = db.pragma("table_info(categories)") as Array<{ name: string }>;
  if (catCols.length === 0) {
    db.exec(`CREATE TABLE IF NOT EXISTS categories (
      name       TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    // Seed default categories
    const seed = db.prepare("INSERT INTO categories (name, sort_order) VALUES (?, ?)");
    const defaults = ["工作流引擎", "后端开发", "前端开发", "内容创作", "工具类", "咨询获取类"];
    defaults.forEach((name, i) => seed.run(name, i));
    console.log("[skill-hub] Categories table created with default seed");
  }

  return db;
}

/** Close database connection (for graceful shutdown) */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
