import { readFileSync } from "fs";
import { join } from "path";
import { buildInstallCmd } from "./github";
import type { SkillRegistry, SkillDetail, AgentType } from "./types";

interface DemoSkill {
  name: string;
  slug: string;
  description: string;
  version?: string;
  triggers?: string[];
  agent: AgentType;
  path: string;
  updatedAt: string;
  files: string[];
}

function loadDemoData(): { skills: DemoSkill[]; updatedAt: string } {
  try {
    const data = readFileSync(join(process.cwd(), "public/demo-registry.json"), "utf-8");
    return JSON.parse(data);
  } catch {
    return { skills: [], updatedAt: new Date().toISOString() };
  }
}

export function getDemoRegistry(): SkillRegistry {
  return loadDemoData();
}

export function getDemoSkill(slug: string): SkillDetail | null {
  const { skills } = loadDemoData();
  const skill = skills.find((s) => s.slug === slug);
  if (!skill) return null;

  const agent = skill.agent || "claude";

  return {
    ...skill,
    agent,
    content: `---\nname: ${skill.name}\ndescription: "${skill.description}"\n---\n\n# ${skill.name}\n\n${skill.description}`,
    installCmd: buildInstallCmd(agent, slug),
  };
}
