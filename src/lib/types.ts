export type AgentType = "claude" | "hermes" | "both";

export interface SkillMeta {
  name: string;
  slug: string;
  description: string;
  version?: string;
  triggers?: string[];
  agent: AgentType;
  /** Relative path in the repo: skills/<slug>/ */
  path: string;
  /** ISO date string */
  updatedAt: string;
  /** File list */
  files: string[];
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
