import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { LocalSyncAgent } from "./types";

/** Recursively collect all file paths under `dir`, returning relative paths */
export function collectFilesRecursive(baseDir: string, dir: string = baseDir): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...collectFilesRecursive(baseDir, fullPath));
    } else if (stat.isFile()) {
      results.push(fullPath.slice(baseDir.length + 1));
    }
  }
  return results;
}

/** Parse YAML frontmatter from skill content */
export function parseFrontmatter(content: string): {
  name: string;
  description: string;
  triggers?: string[];
} {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { name: "", description: "" };

  const fm = match[1];
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const descMatch = fm.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  const readWhenMatch = fm.match(/^read_when:\s*\n((?:\s*-\s*.+\n?)+)/m);

  let triggers: string[] | undefined;
  if (readWhenMatch) {
    triggers = readWhenMatch[1]
      .split("\n")
      .map((l) => l.replace(/^\s*-\s*/, "").trim())
      .filter(Boolean);
  }

  return {
    name: nameMatch?.[1]?.trim() || "",
    description: descMatch?.[1]?.trim() || "",
    triggers,
  };
}

/** Get the base local skill directory for an agent */
export function getLocalSkillDir(agent: LocalSyncAgent): string {
  return join(homedir(), agent === "claude" ? ".claude/skills" : ".hermes/skills");
}

export interface ScannedLocalSkill {
  slug: string;
  name: string;
  description: string;
  path: string;
  files: string[];
}

/** Scan local skill directory for a given agent */
export function scanLocalSkills(agent: LocalSyncAgent): ScannedLocalSkill[] {
  const dirPath = getLocalSkillDir(agent);
  if (!existsSync(dirPath)) return [];

  let entries: string[];
  try {
    entries = readdirSync(dirPath);
  } catch {
    return [];
  }

  const skills: ScannedLocalSkill[] = [];

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const fullPath = join(dirPath, entry);
    if (!statSync(fullPath).isDirectory()) continue;

    const files = collectFilesRecursive(fullPath);
    if (files.length === 0) continue;

    let name = entry;
    let description = "";

    const skillMdPath = join(fullPath, "SKILL.md");
    if (existsSync(skillMdPath)) {
      try {
        const content = readFileSync(skillMdPath, "utf-8");
        const fm = parseFrontmatter(content);
        if (fm.name) name = fm.name;
        if (fm.description) description = fm.description;
      } catch {
        // Ignore parse errors
      }
    }

    skills.push({ slug: entry, name, description, path: fullPath, files });
  }

  return skills;
}
