import postgres, { type Sql } from "postgres";

// Supabase Postgres (postgres.js). Pure-JS, serverless friendly.
// Connection string: SUPABASE_DB_URL
// (Supabase Dashboard → Project Settings → Database → Connection string → URI / Transaction mode :6543)

let sqlPromise: Promise<Sql> | null = null;

const SCHEMA_STMTS = [
  `CREATE TABLE IF NOT EXISTS skills (
    slug        TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    version     TEXT NOT NULL DEFAULT '1.0.0',
    agent       TEXT NOT NULL DEFAULT 'claude',
    triggers    TEXT NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    checksum    TEXT NOT NULL DEFAULT '',
    category    TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS skill_files (
    id          BIGSERIAL PRIMARY KEY,
    skill_slug  TEXT NOT NULL REFERENCES skills(slug) ON DELETE CASCADE,
    filename    TEXT NOT NULL,
    content     TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(skill_slug, filename)
  )`,
  `CREATE TABLE IF NOT EXISTS sync_log (
    id          BIGSERIAL PRIMARY KEY,
    skill_slug  TEXT NOT NULL,
    action      TEXT NOT NULL,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
    device_id   TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    name       TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

/** 把 SQLite 风格 ? 占位符转成 Postgres $N。要求 SQL 模板内不含字面 '?'（值一律走参数）。 */
function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/**
 * Get the postgres.js singleton. Idempotently ensures schema + seeds default
 * categories on first connect. Module-level Promise cache avoids concurrent
 * first-call races and lets warm serverless instances reuse the pool.
 */
export function getClient(): Promise<Sql> {
  if (sqlPromise) return sqlPromise;

  sqlPromise = (async () => {
    const url = process.env.SUPABASE_DB_URL;
    if (!url) {
      throw new Error(
        "[skill-hub] 缺少 SUPABASE_DB_URL（Supabase Postgres 直连串）。请在 .env.local 配置后重启。"
      );
    }

    const sql = postgres(url, {
      // Supabase pooler (transaction mode, :6543) 不支持 prepared statements
      prepare: false,
      max: 5,
      // timestamptz / timestamp 列返回原始字符串（与原 libSQL TEXT 行为对齐，
      // 避免 Date 对象污染下游把时间戳当字符串用的代码）。
      // postgres.js 运行时支持仅覆盖 parse；TS 的 PostgresType 要求完整
      // to/from/serialize，故断言。
      types: {
        timestamptz: { parse: (v: string) => v },
        timestamp: { parse: (v: string) => v },
      } as never,
    });

    // 幂等建表（Supabase 已建则 IF NOT EXISTS 跳过）
    for (const stmt of SCHEMA_STMTS) {
      await sql.unsafe(stmt);
    }

    // 仅在空表时播种默认分类
    const seeded = await sql`SELECT COUNT(*)::int AS c FROM categories`;
    if (Number((seeded[0] as { c?: number }).c ?? 0) === 0) {
      await sql.begin((tx) =>
        Promise.all(
          DEFAULT_CATEGORIES.map((name, i) =>
            tx`INSERT INTO categories (name, sort_order) VALUES (${name}, ${i})`
          )
        )
      );
    }

    console.log("[skill-hub] Database ready (Supabase Postgres)");
    return sql;
  })().catch((e) => {
    sqlPromise = null; // 允许瞬时失败后重试
    throw e;
  });

  return sqlPromise;
}

// --- 查询 helper（供 storage.ts / sync.ts 使用；SQL 沿用 ? 占位符，内部转 $N）---

export type Row = Record<string, unknown>;

/** SELECT：返回行数组。 */
export async function queryRows<T = Row>(sqlText: string, args: unknown[] = []): Promise<T[]> {
  const sql = await getClient();
  return (await sql.unsafe(toPg(sqlText), args as never[])) as unknown as T[];
}

/** SELECT：返回首行（无结果返回 undefined）。 */
export async function queryOne<T = Row>(
  sqlText: string,
  args: unknown[] = []
): Promise<T | undefined> {
  const rows = await queryRows<T>(sqlText, args);
  return rows[0];
}

/** 写操作：返回受影响行数。 */
export async function execWrite(sqlText: string, args: unknown[] = []): Promise<number> {
  const sql = await getClient();
  const res = (await sql.unsafe(toPg(sqlText), args as never[])) as unknown as { count?: number };
  return res.count ?? 0;
}

/** 事务批量：逐条执行，返回每条受影响行数（顺序与 stmts 一致）。 */
export async function txBatch(
  stmts: Array<{ sql: string; args?: unknown[] }>
): Promise<number[]> {
  const sql = await getClient();
  return sql.begin(async (tx) => {
    const counts: number[] = [];
    for (const s of stmts) {
      const res = (await tx.unsafe(toPg(s.sql), (s.args ?? []) as never[])) as unknown as {
        count?: number;
      };
      counts.push(res.count ?? 0);
    }
    return counts;
  });
}
