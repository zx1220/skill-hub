/**
 * 一次性迁移脚本：本地 libSQL (data/local.db) → Supabase Postgres。
 *
 * 用法：
 *   1. 在 .env.local 设置 SUPABASE_DB_URL（Supabase Postgres 直连串）
 *   2. bun run migrate:supabase
 *
 * SUPABASE_DB_URL 取值（Supabase Dashboard → Project Settings → Database →
 * Connection string → "URI" / Transaction mode）：
 *   postgresql://postgres.nprirjszehmadrxzxgcs:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
 *
 * 幂等：默认 ON CONFLICT DO NOTHING，可重复运行。
 * 加 RESET=1（RESET=1 bun run migrate:supabase）会先 TRUNCATE 目标表再全量灌入。
 *
 * 注意：不会触碰本地 libSQL 源库，全程只读本地、只写 Supabase。
 */
import { createClient } from "@libsql/client";
import postgres from "postgres";

const SRC_URL = "file:./data/local.db";
const DST_URL = process.env.SUPABASE_DB_URL;
const RESET = process.env.RESET === "1";

if (!DST_URL) {
  console.error("❌ 缺少环境变量 SUPABASE_DB_URL（Supabase Postgres 直连串）");
  console.error("   在 .env.local 里填：SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@...:6543/postgres");
  process.exit(1);
}

const src = createClient({ url: SRC_URL });
// prepare:false —— 一次性脚本，省去 prepared statement 的往返；走 pooler(6543) 时更稳。
const dst = postgres(DST_URL, { prepare: false, max: 4 });

/**
 * libSQL datetime('now') 产出 "YYYY-MM-DD HH:MM:SS"（秒）或 ".SSS"（毫秒），均为 UTC、无时区标记。
 * 转成 ISO UTC 串（保留毫秒）供 TIMESTAMPTZ 列正确解析。
 */
function toUtcIso(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?/);
  if (m) return `${m[1]}T${m[2]}${m[3] ?? ""}Z`;
  return s; // 已是 ISO 或其他格式，原样交给 Postgres
}

async function readAll<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const { rows } = await src.execute(sql);
  return rows as T[];
}

async function migrate() {
  console.log("▶ 读取本地 libSQL (data/local.db) …");

  const categories = await readAll(
    "SELECT name, sort_order, created_at FROM categories ORDER BY sort_order, name"
  );
  const skills = await readAll(
    "SELECT slug, name, description, version, agent, triggers, created_at, updated_at, checksum, category FROM skills ORDER BY slug"
  );
  const skillFiles = await readAll(
    "SELECT skill_slug, filename, content, updated_at FROM skill_files ORDER BY skill_slug, filename"
  );
  const syncLog = await readAll(
    "SELECT skill_slug, action, timestamp, device_id FROM sync_log ORDER BY timestamp"
  );

  console.log(
    `  源库行数：categories=${categories.length} skills=${skills.length} skill_files=${skillFiles.length} sync_log=${syncLog.length}`
  );

  if (RESET) {
    console.log("▶ RESET=1，清空目标表（TRUNCATE … CASCADE）…");
    await dst`TRUNCATE skill_files, sync_log, skills, categories RESTART IDENTITY CASCADE`;
  }

  // categories（独立参考表）
  if (categories.length) {
    const rows = categories.map((c) => ({
      name: c.name,
      sort_order: c.sort_order as number,
      created_at: toUtcIso(c.created_at),
    }));
    const r = await dst`
      INSERT INTO categories ${dst(rows, ["name", "sort_order", "created_at"])}
      ON CONFLICT (name) DO NOTHING
    `;
    console.log(`✓ categories 完成 (affected=${r.count})`);
  }

  // skills（元数据）
  if (skills.length) {
    const rows = skills.map((s) => ({
      slug: s.slug,
      name: s.name,
      description: s.description,
      version: s.version,
      agent: s.agent,
      triggers: s.triggers,
      created_at: toUtcIso(s.created_at),
      updated_at: toUtcIso(s.updated_at),
      checksum: s.checksum,
      category: s.category ?? null,
    }));
    const r = await dst`
      INSERT INTO skills ${dst(rows, ["slug", "name", "description", "version", "agent", "triggers", "created_at", "updated_at", "checksum", "category"])}
      ON CONFLICT (slug) DO NOTHING
    `;
    console.log(`✓ skills 完成 (affected=${r.count})`);
  }

  // skill_files（大文本，分批）
  if (skillFiles.length) {
    const BATCH = 50;
    for (let i = 0; i < skillFiles.length; i += BATCH) {
      const slice = skillFiles.slice(i, i + BATCH);
      const rows = slice.map((f) => ({
        skill_slug: f.skill_slug,
        filename: f.filename,
        content: f.content,
        updated_at: toUtcIso(f.updated_at),
      }));
      const r = await dst`
        INSERT INTO skill_files ${dst(rows, ["skill_slug", "filename", "content", "updated_at"])}
        ON CONFLICT (skill_slug, filename) DO NOTHING
      `;
      process.stdout.write(`\r✓ skill_files ${Math.min(i + BATCH, skillFiles.length)}/${skillFiles.length} (batch affected=${r.count})`);
    }
    console.log("");
  }

  // sync_log
  if (syncLog.length) {
    const rows = syncLog.map((l) => ({
      skill_slug: l.skill_slug,
      action: l.action,
      timestamp: toUtcIso(l.timestamp),
      device_id: l.device_id ?? null,
    }));
    const r = await dst`
      INSERT INTO sync_log ${dst(rows, ["skill_slug", "action", "timestamp", "device_id"])}
    `;
    console.log(`✓ sync_log 完成 (affected=${r.count})`);
  }

  // 校验：Supabase 最终行数
  const counts = await dst`
    SELECT
      (SELECT COUNT(*) FROM categories) AS categories,
      (SELECT COUNT(*) FROM skills)       AS skills,
      (SELECT COUNT(*) FROM skill_files)  AS skill_files,
      (SELECT COUNT(*) FROM sync_log)     AS sync_log
  `;
  console.log("▶ Supabase 最终行数：", counts[0]);

  await src.close();
  await dst.end({ timeout: 5 });
  console.log("✅ 迁移完成");
}

migrate().catch(async (e) => {
  console.error("❌ 迁移失败：", e);
  try {
    await src.close();
    await dst.end({ timeout: 5 });
  } catch {
    /* ignore */
  }
  process.exit(1);
});
