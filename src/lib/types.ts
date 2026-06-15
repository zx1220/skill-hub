export type AgentType = "claude" | "hermes" | "both";

export interface SkillMeta {
  name: string;
  slug: string;
  description: string;
  version?: string;
  triggers?: string[];
  agent: AgentType;
  /** Relative path: skills/<slug>/ */
  path: string;
  /** ISO date string */
  updatedAt: string;
  /** File list */
  files: string[];
  /** AI classification category */
  category?: string;
}

export interface SkillDetail extends SkillMeta {
  /** Raw SKILL.md content */
  content: string;
  /** Install command */
  installCmd: string;
}

export interface CreateSkillInput {
  name: string;
  slug: string;
  description: string;
  triggers: string[];
  agent: AgentType;
  content: string; // SKILL.md content
}

export interface SkillRegistry {
  skills: SkillMeta[];
  updatedAt: string;
}

// === Sync Protocol ===

export interface SkillFile {
  filename: string;
  content: string;
}

export interface SyncPushRequest {
  slug: string;
  files: SkillFile[];
  checksum: string;
  base_checksum?: string;
  device_id?: string;
}

export interface SyncPullResponse {
  changes: SyncChange[];
  server_time: string;
}

export interface SyncChange {
  slug: string;
  action: "create" | "update" | "delete";
  files: SkillFile[];
  checksum: string;
  timestamp: string;
}

export interface SyncStatusResponse {
  skill_count: number;
  last_modified: string | null;
  server_time: string;
}

// === Import ===

export interface ImportResult {
  imported: number;
  skills: Array<{ slug: string; name?: string }>;
  errors: Array<{ slug?: string; error: string }>;
}

export interface LocalSkillScan {
  slug: string;
  name: string;
  description: string;
  source: "claude" | "hermes";
  path: string;
  files: string[];
}

export interface ImportUrlRequest {
  url: string;
  agent?: AgentType;
}

export interface ImportGitHubRequest {
  repo: string;
  token?: string;
  branch?: string;
}

export interface ImportLocalRequest {
  skills: Array<{ slug: string; source: "claude" | "hermes" }>;
}

// === Local Sync ===

export type LocalSyncAgent = "claude" | "hermes";

export interface LocalSyncCompareResponse {
  agent: LocalSyncAgent;
  localOnly: Array<{ slug: string; name: string; description: string; path: string }>;
  hubOnly: Array<{ slug: string; name: string; description: string; agent: AgentType; version?: string }>;
  synced: Array<{ slug: string; name: string }>;
}

export interface LocalSyncDeleteResponse {
  deleted: number;
  errors: Array<{ slug: string; error: string }>;
}

export interface LocalSyncInstallResponse {
  installed: number;
  errors: Array<{ slug: string; error: string }>;
}

