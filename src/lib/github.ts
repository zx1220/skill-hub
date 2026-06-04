import { GITHUB_CONFIG } from "./constants";
import type { SkillMeta, SkillDetail, SkillRegistry, CreateSkillInput, AgentType } from "./types";

const BASE = "https://api.github.com";

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (GITHUB_CONFIG.token) {
    h.Authorization = `Bearer ${GITHUB_CONFIG.token}`;
  }
  return h;
}

function repoUrl(path: string) {
  return `${BASE}/repos/${GITHUB_CONFIG.repo}/contents/${path}?ref=${GITHUB_CONFIG.branch}`;
}

/** Parse SKILL.md frontmatter */
function parseFrontmatter(content: string): {
  name: string;
  description: string;
  triggers?: string[];
  version?: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { name: "", description: "" };

  const fm = match[1];
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const descMatch = fm.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  const readWhenMatch = fm.match(/^read_when:\s*\n((?:\s*-\s*.+\n?)+)/m);
  const versionMatch = fm.match(/^version:\s*["']?(.+?)["']?\s*$/m);

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
    version: versionMatch?.[1]?.trim(),
  };
}

/** Fetch file content from GitHub */
async function fetchFile(path: string): Promise<string> {
  const res = await fetch(repoUrl(path), { headers: headers() });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  const data = await res.json();
  return atob(data.content);
}

/** List directory contents from GitHub */
async function listDir(path: string): Promise<{ name: string; path: string; type: string }[]> {
  const res = await fetch(repoUrl(path), { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((item: { name: string; path: string; type: string }) => ({
    name: item.name,
    path: item.path,
    type: item.type,
  }));
}

/** Get the skill registry index */
export async function getSkillRegistry(): Promise<SkillRegistry> {
  try {
    const content = await fetchFile("registry.json");
    return JSON.parse(content);
  } catch {
    // If no registry.json, build from directory listing
    return buildRegistry();
  }
}

/** Build registry by scanning repo */
async function buildRegistry(): Promise<SkillRegistry> {
  const dirs = await listDir("skills");
  const skills: SkillMeta[] = [];

  for (const dir of dirs) {
    if (dir.type !== "dir") continue;

    try {
      const skillMd = await fetchFile(`${dir.path}/SKILL.md`);
      const parsed = parseFrontmatter(skillMd);
      const files = await listDir(dir.path);

      // Detect agent from directory structure or metadata
      const metaFile = files.find((f) => f.name === "_meta.json");
      let agent: "claude" | "hermes" | "both" = "claude";
      if (metaFile) {
        try {
          const metaContent = await fetchFile(metaFile.path);
          const meta = JSON.parse(metaContent);
          // If ownerId exists, it's from clawic store (used by both)
          agent = "both";
        } catch {
          // ignore
        }
      }

      skills.push({
        name: parsed.name || dir.name,
        slug: dir.name,
        description: parsed.description,
        version: parsed.version,
        triggers: parsed.triggers,
        agent,
        path: dir.path,
        updatedAt: new Date().toISOString(),
        files: files.map((f) => f.name),
      });
    } catch {
      // Skip skills without SKILL.md
    }
  }

  return { skills, updatedAt: new Date().toISOString() };
}

/** Get a single skill detail */
export async function getSkillDetail(slug: string): Promise<SkillDetail | null> {
  const dirPath = `skills/${slug}`;
  const content = await fetchFile(`${dirPath}/SKILL.md`);
  const parsed = parseFrontmatter(content);
  const files = await listDir(dirPath);

  const metaFile = files.find((f) => f.name === "_meta.json");
  const isBoth = !!metaFile;
  const installCmd = isBoth
    ? `skill-sync install ${slug} --agent claude\nskill-sync install ${slug} --agent hermes`
    : `skill-sync install ${slug} --agent claude`;

  return {
    name: parsed.name || slug,
    slug,
    description: parsed.description,
    version: parsed.version,
    triggers: parsed.triggers,
    agent: isBoth ? "both" : "claude",
    path: dirPath,
    updatedAt: new Date().toISOString(),
    files: files.map((f) => f.name),
    content,
    installCmd,
  };
}

/** Create or update a skill via GitHub API */
export async function upsertSkill(input: CreateSkillInput): Promise<{ sha: string }> {
  const { slug, content, agent, name, description, triggers } = input;

  // Build SKILL.md with frontmatter
  const triggerLines = triggers?.length
    ? `\nread_when:\n${triggers.map((t) => `  - ${t}`).join("\n")}`
    : "";

  const skillMd = `---
name: ${name}
description: "${description}"${triggerLines}
---

${content}`;

  const path = `skills/${slug}/SKILL.md`;
  let sha: string | undefined;

  // Try to get existing file SHA for update
  try {
    const existing = await fetch(repoUrl(path), { headers: headers() });
    if (existing.ok) {
      const data = await existing.json();
      sha = data.sha;
    }
  } catch {
    // File doesn't exist yet
  }

  const body: Record<string, unknown> = {
    message: `${sha ? "Update" : "Add"} skill: ${slug}`,
    content: btoa(unescape(encodeURIComponent(skillMd))),
    branch: GITHUB_CONFIG.branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(repoUrl(path), {
    method: "PUT",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to upsert skill: ${err}`);
  }

  const data = await res.json();

  // Also update registry.json
  await updateRegistry();

  return { sha: data.content.sha };
}

/** Delete a skill from GitHub */
export async function deleteSkill(slug: string): Promise<void> {
  const path = `skills/${slug}/SKILL.md`;

  // Get SHA of existing file
  const existing = await fetch(repoUrl(path), { headers: headers() });
  if (!existing.ok) throw new Error(`Skill ${slug} not found`);
  const data = await existing.json();
  const sha = data.sha;

  // Delete the file
  const res = await fetch(repoUrl(path), {
    method: "DELETE",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Delete skill: ${slug}`,
      sha,
      branch: GITHUB_CONFIG.branch,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to delete skill: ${err}`);
  }

  await updateRegistry();
}

/** Update the registry.json file */
async function updateRegistry(): Promise<void> {
  const registry = await buildRegistry();
  const content = JSON.stringify(registry, null, 2);

  let sha: string | undefined;
  try {
    const existing = await fetch(repoUrl("registry.json"), { headers: headers() });
    if (existing.ok) {
      const data = await existing.json();
      sha = data.sha;
    }
  } catch {
    // doesn't exist
  }

  const body: Record<string, unknown> = {
    message: "Update skill registry",
    content: btoa(unescape(encodeURIComponent(content))),
    branch: GITHUB_CONFIG.branch,
  };
  if (sha) body.sha = sha;

  await fetch(repoUrl("registry.json"), {
    method: "PUT",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
