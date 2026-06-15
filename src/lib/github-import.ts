import type { SkillFile, AgentType } from "./types";

const GH_API = "https://api.github.com";

interface GhContent {
  name: string;
  path: string;
  type: string;
  content?: string;
  encoding?: string;
}

async function ghFetch(url: string, token: string): Promise<GhContent[] | GhContent> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "skill-hub",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function b64Decode(b64: string): string {
  return Buffer.from(b64, "base64").toString("utf-8");
}

interface ImportedSkill {
  slug: string;
  files: SkillFile[];
  name: string;
  description: string;
  triggers: string[];
}

/**
 * Recursively collect all files under a GitHub directory.
 * Returns relative paths (e.g. "examples/demo.md") from the base dir.
 */
async function collectFilesRecursively(
  repo: string,
  dirPath: string,
  token: string,
  branch: string,
  basePath: string = ""
): Promise<SkillFile[]> {
  const items = (await ghFetch(
    `${GH_API}/repos/${repo}/contents/${dirPath}?ref=${branch}`,
    token
  )) as GhContent[];

  if (!Array.isArray(items)) return [];

  const files: SkillFile[] = [];

  for (const item of items) {
    const relPath = basePath ? `${basePath}/${item.name}` : item.name;

    if (item.type === "dir") {
      // Recurse into subdirectories
      try {
        const subFiles = await collectFilesRecursively(
          repo,
          item.path,
          token,
          branch,
          relPath
        );
        files.push(...subFiles);
      } catch (e) {
        console.warn(`[github-import] Failed to read subdir ${relPath}:`, e);
      }
    } else if (item.type === "file") {
      try {
        const fileData = (await ghFetch(
          `${GH_API}/repos/${repo}/contents/${item.path}?ref=${branch}`,
          token
        )) as GhContent;

        if (fileData.content) {
          const content = b64Decode(fileData.content.replace(/\n/g, ""));
          files.push({ filename: relPath, content });
        } else {
          console.warn(`[github-import] Skipped ${relPath}: content too large or empty`);
        }
      } catch (e) {
        console.warn(`[github-import] Failed to fetch file ${relPath}:`, e);
      }
    }
  }

  return files;
}

/**
 * Try listing a GitHub directory; return null if 404.
 */
async function tryListDir(
  repo: string,
  path: string,
  token: string,
  branch: string
): Promise<GhContent[] | null> {
  try {
    const items = (await ghFetch(
      `${GH_API}/repos/${repo}/contents/${path}?ref=${branch}`,
      token
    )) as GhContent[];
    return Array.isArray(items) ? items : null;
  } catch (e) {
    // 404 means directory doesn't exist — not an error, just absent
    if (e instanceof Error && e.message.includes("404")) return null;
    throw e;
  }
}

/**
 * Detect skill directories from a list of items.
 * A directory is treated as a skill if it contains a .md file (SKILL.md, skill.md, etc).
 */
function isSkillDirCandidate(items: GhContent[]): boolean {
  return items.some(
    (item) => item.type === "file" && /\.(md|markdown|txt)$/i.test(item.name)
  );
}

/**
 * Query GitHub for the repo's default branch name.
 */
async function getDefaultBranch(repo: string, token: string): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "skill-hub",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${GH_API}/repos/${repo}`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch repo info: ${res.status}`);
  const data = await res.json();
  return data.default_branch;
}

/**
 * Fetch all skills from a GitHub repo.
 * Looks in `skills/` directory first; falls back to repo root if not found.
 * Recursively collects files from subdirectories within each skill.
 */
export async function fetchSkillsFromRepo(
  repo: string,
  token: string,
  branch = "main"
): Promise<ImportedSkill[]> {
  // 1. Try skills/ directory first
  let rootItems = await tryListDir(repo, "skills", token, branch);

  // 2. Fallback: treat repo root as the skills directory
  if (!rootItems) {
    rootItems = await tryListDir(repo, "", token, branch);
  }

  // 3. If branch not found, auto-detect the default branch and retry
  if (!rootItems) {
    try {
      const defaultBranch = await getDefaultBranch(repo, token);
      if (defaultBranch && defaultBranch !== branch) {
        console.log(`[github-import] Branch "${branch}" not found, retrying with default branch "${defaultBranch}"`);
        branch = defaultBranch;
        rootItems = await tryListDir(repo, "skills", token, branch);
        if (!rootItems) {
          rootItems = await tryListDir(repo, "", token, branch);
        }
      }
    } catch {
      // Can't determine default branch — fall through to error
    }
  }

  if (!rootItems) {
    throw new Error(
      "Could not read repo contents. Check that the repo exists and the branch is correct."
    );
  }

  // 3. Find candidate skill directories
  const dirs = rootItems.filter(
    (item) => item.type === "dir" && !item.name.startsWith(".")
  );

  const results: ImportedSkill[] = [];

  for (const dir of dirs) {
    const slug = dir.name;

    try {
      // Check if this directory looks like a skill (has .md files)
      const dirItems = await tryListDir(repo, dir.path, token, branch);
      if (!dirItems || !isSkillDirCandidate(dirItems)) continue;

      // Recursively collect all files in skill directory (including subdirs)
      const files = await collectFilesRecursively(
        repo,
        dir.path,
        token,
        branch
      );

      if (files.length === 0) continue;

      // Parse frontmatter from SKILL.md
      const skillMd = files.find(
        (f) =>
          f.filename === "SKILL.md" ||
          f.filename === "skill.md" ||
          f.filename.endsWith("/SKILL.md") ||
          f.filename.endsWith("/skill.md")
      );
      const fm = parseFrontmatter(skillMd?.content || "");

      results.push({
        slug,
        files,
        name: fm.name || slug,
        description: fm.description || "",
        triggers: fm.triggers || [],
      });
    } catch (e) {
      console.error(`[github-import] Failed to import ${slug}:`, e);
    }
  }

  return results;
}

function parseFrontmatter(content: string): {
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
