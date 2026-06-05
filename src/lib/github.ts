import { GITHUB_CONFIG } from "./constants";
import type { SkillMeta, SkillDetail, SkillRegistry, CreateSkillInput, AgentType } from "./types";

const BASE = "https://api.github.com";
const CACHE_TTL = 60_000; // 60s

// --- In-memory cache ---
const cache = new Map<string, { data: unknown; expiry: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

function clearCache(): void {
  cache.clear();
}

// --- GitHub helpers ---

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

// --- Frontmatter parser ---

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

// --- Install command builder (DRY) ---

export function buildInstallCmd(agent: AgentType, slug: string): string {
  if (agent === "hermes") {
    return `skill-sync install ${slug} --agent hermes`;
  }
  if (agent === "both") {
    return `skill-sync install ${slug} --agent claude\nskill-sync install ${slug} --agent hermes`;
  }
  return `skill-sync install ${slug} --agent claude`;
}

// --- Low-level GitHub API ---

async function fetchFile(path: string): Promise<string> {
  const res = await fetch(repoUrl(path), { headers: headers() });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  const data = await res.json();
  return atob(data.content);
}

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

/** Get the last commit date for a path from GitHub */
async function getLastCommitDate(path: string): Promise<string> {
  try {
    const url = `${BASE}/repos/${GITHUB_CONFIG.repo}/commits?path=${path}&per_page=1`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) return "";
    const commits = await res.json();
    if (Array.isArray(commits) && commits.length > 0) {
      return commits[0].commit?.committer?.date || "";
    }
  } catch {
    // fallback to empty
  }
  return "";
}

// --- Public API ---

export async function getSkillRegistry(): Promise<SkillRegistry> {
  const cacheKey = "registry";
  const cached = getCached<SkillRegistry>(cacheKey);
  if (cached) return cached;

  try {
    const content = await fetchFile("registry.json");
    const registry = JSON.parse(content) as SkillRegistry;
    setCache(cacheKey, registry);
    return registry;
  } catch {
    const registry = await buildRegistry();
    setCache(cacheKey, registry);
    return registry;
  }
}

async function buildRegistry(): Promise<SkillRegistry> {
  const dirs = await listDir("skills");
  if (dirs.length === 0) return { skills: [], updatedAt: "" };

  // Fetch all skills in parallel
  const results = await Promise.allSettled(
    dirs
      .filter((dir) => dir.type === "dir")
      .map(async (dir) => {
        const skillMd = await fetchFile(`${dir.path}/SKILL.md`);
        const parsed = parseFrontmatter(skillMd);
        const files = await listDir(dir.path);

        const metaFile = files.find((f) => f.name === "_meta.json");
        let agent: AgentType = "claude";
        if (metaFile) {
          try {
            await fetchFile(metaFile.path);
            agent = "both";
          } catch {
            // ignore
          }
        }

        const updatedAt = await getLastCommitDate(dir.path);

        const skill: SkillMeta = {
          name: parsed.name || dir.name,
          slug: dir.name,
          description: parsed.description,
          version: parsed.version,
          triggers: parsed.triggers,
          agent,
          path: dir.path,
          updatedAt,
          files: files.map((f) => f.name),
        };
        return skill;
      })
  );

  const skills = results
    .filter((r): r is PromiseFulfilledResult<SkillMeta> => r.status === "fulfilled")
    .map((r) => r.value);

  return { skills, updatedAt: new Date().toISOString() };
}

export async function getSkillDetail(slug: string): Promise<SkillDetail | null> {
  const cacheKey = `detail:${slug}`;
  const cached = getCached<SkillDetail>(cacheKey);
  if (cached) return cached;

  const dirPath = `skills/${slug}`;
  const content = await fetchFile(`${dirPath}/SKILL.md`);
  const parsed = parseFrontmatter(content);
  const files = await listDir(dirPath);

  const metaFile = files.find((f) => f.name === "_meta.json");
  const agent: AgentType = metaFile ? "both" : "claude";
  const installCmd = buildInstallCmd(agent, slug);
  const updatedAt = await getLastCommitDate(dirPath);

  const detail: SkillDetail = {
    name: parsed.name || slug,
    slug,
    description: parsed.description,
    version: parsed.version,
    triggers: parsed.triggers,
    agent,
    path: dirPath,
    updatedAt,
    files: files.map((f) => f.name),
    content,
    installCmd,
  };

  setCache(cacheKey, detail);
  return detail;
}

export async function upsertSkill(input: CreateSkillInput): Promise<{ sha: string }> {
  const { slug, content, agent, name, description, triggers } = input;

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

  // Invalidate cache after write
  clearCache();

  await updateRegistry();

  return { sha: data.content.sha };
}

export async function deleteSkill(slug: string): Promise<void> {
  const dirPath = `skills/${slug}`;

  // List all files in the skill directory
  const files = await listDir(dirPath);

  // Delete each file in parallel
  await Promise.all(
    files.map(async (file) => {
      // Get SHA for each file
      const fileRes = await fetch(repoUrl(file.path), { headers: headers() });
      if (!fileRes.ok) return; // skip files we can't get SHA for

      const fileData = await fileRes.json();
      const fileSha = fileData.sha;

      await fetch(repoUrl(file.path), {
        method: "DELETE",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Delete ${file.name} from skill: ${slug}`,
          sha: fileSha,
          branch: GITHUB_CONFIG.branch,
        }),
      });
    })
  );

  // Also try to delete the directory entry itself if no files found
  if (files.length === 0) {
    const skillPath = `${dirPath}/SKILL.md`;
    const existing = await fetch(repoUrl(skillPath), { headers: headers() });
    if (existing.ok) {
      const data = await existing.json();
      await fetch(repoUrl(skillPath), {
        method: "DELETE",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Delete skill: ${slug}`,
          sha: data.sha,
          branch: GITHUB_CONFIG.branch,
        }),
      });
    }
  }

  // Invalidate cache after write
  clearCache();

  await updateRegistry();
}

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
