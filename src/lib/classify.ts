import type { SkillMeta } from "./types";

export interface ClassificationRule {
  category: string;
  keywords: string[];
}

/**
 * 默认关键词分类规则。
 * 匹配优先级：数组顺序，先匹配到的胜出。
 * 未匹配任何规则的技能归入 defaultCategory。
 */
export const DEFAULT_RULES: ClassificationRule[] = [
  {
    category: "工作流引擎",
    keywords: [
      "workflow", "工作流", "tdd", "spec-first", "subagent",
      "loop", "polling", "cron", "schedule", "orchestrat",
      "pipeline", "superpowers", "loop",
    ],
  },
  {
    category: "后端开发",
    keywords: [
      "backend", "后端", "java", "spring", "server", "database",
      "sql", "数据库", "code-gen", "生成代码", "api",
      "debug", "diagnose", "doctor", "security",
    ],
  },
  {
    category: "前端开发",
    keywords: [
      "frontend", "前端", "react", "next.js", "tailwind", "ui",
      "component", "css", "html", "vue", "svelte",
      "ui-ux", "browser", "screenshot",
    ],
  },
  {
    category: "内容创作",
    keywords: [
      "copywriting", "writing", "marketing", "content", "email",
      "创作", "文案", "小红书", "xhs", "video", "obsidian",
      "summarize", "prd", "excel",
    ],
  },
  {
    category: "咨询获取类",
    keywords: [
      "research", "search", "weather", "forecast", "deep-research",
      "multi-search", "web", "fetch", "crawl", "scrape",
      "agent-browser",
    ],
  },
  // "工具类" is the catch-all default — no keywords needed
];

/**
 * 对单个技能分类，返回分类名称。
 */
export function classifySkill(
  skill: SkillMeta,
  rules: ClassificationRule[] = DEFAULT_RULES,
  defaultCategory: string = "工具类",
): string {
  const text = [
    skill.name,
    skill.description,
    ...(skill.triggers || []),
    ...skill.files,
  ]
    .join(" ")
    .toLowerCase();

  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (text.includes(kw.toLowerCase())) {
        return rule.category;
      }
    }
  }
  return defaultCategory;
}

/**
 * 批量分类，返回 { slug: category } 映射。
 */
export function classifySkills(
  skills: SkillMeta[],
  rules: ClassificationRule[] = DEFAULT_RULES,
  defaultCategory: string = "工具类",
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const skill of skills) {
    result[skill.slug] = classifySkill(skill, rules, defaultCategory);
  }
  return result;
}
