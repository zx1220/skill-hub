import { join } from "path";

export const AGENT_COLORS = {
  claude: {
    bg: "rgba(168,85,247,0.12)",
    text: "#a855f7",
    border: "rgba(168,85,247,0.25)",
    label: "Claude Code",
  },
  hermes: {
    bg: "rgba(249,115,22,0.12)",
    text: "#f97316",
    border: "rgba(249,115,22,0.25)",
    label: "Hermes",
  },
  both: {
    bg: "rgba(99,102,241,0.12)",
    text: "#6366f1",
    border: "rgba(99,102,241,0.25)",
    label: "Both",
  },
} as const;

export const AGENT_INSTALL_PATHS = {
  claude: "~/.claude/skills",
  hermes: "~/.hermes/skills",
} as const;

export const AGENT_TYPES = ["claude", "hermes", "both"] as const;

// NOTE: DB 连接由 db.ts 的 postgres.js 客户端管理（Supabase Postgres，SUPABASE_DB_URL）。
// 已无 FS skill-dir 存储，此处仅 master key 路径可配置。
export const DB_CONFIG = {
  /** Master API key file — local fallback when SKILL_MASTER_KEY env is unset. */
  masterKeyPath: process.env.SKILL_MASTER_KEY_PATH || join(process.cwd(), "data", ".master-key"),
} as const;

export const GITHUB_CONFIG = {
  repo: process.env.SKILL_REPO || "",
  branch: process.env.SKILL_BRANCH || "main",
  token: process.env.GITHUB_TOKEN || "",
} as const;

export const AI_CONFIG = {
  apiKey: process.env.ANTHROPIC_API_KEY || "",
} as const;

export const SITE_CONFIG = {
  name: "Skill Hub",
  description: "AI Skill Registry — manage, discover, and sync skills for Claude Code & Hermes",
} as const;
