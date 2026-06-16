import type { SkillFile } from "./types";

const GH_API = "https://api.github.com";

// Cap concurrent file downloads so a large import doesn't fire dozens of
// simultaneous API requests at once.
const FETCH_CONCURRENCY = 8;

interface GhTreeItem {
  path: string;
  type: "blob" | "tree";
}

interface ImportedSkill {
  slug: string;
  files: SkillFile[];
  name: string;
  description: string;
  triggers: string[];
}

// --- Low-level GitHub API ---

async function ghFetch<T = unknown>(url: string, token: string): Promise<T> {
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
  return res.json() as Promise<T>;
}

/**
 * Fetch a single file's raw body via the Contents API with the raw media type.
 *
 * raw.githubusercontent.com and codeload tarballs are DNS-polluted / unreachable
 * in some networks (301 → 404), so we stay on api.github.com, which is reachable
 * and returns the literal file content with `Accept: application/vnd.github.raw`.
 *
 * Cost: 1 REST request per file. The Git Trees call already enumerated every
 * path, so we skip all the per-directory listDir requests the old recursive
 * walker issued — importing one skill is roughly (1 tree + N file) requests.
 */
async function fetchFileContents(
  repo: string,
  branch: string,
  path: string,
  token: string
): Promise<string> {
  const encPath = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const url = `${GH_API}/repos/${repo}/contents/${encPath}?ref=${branch}`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.raw",
    "User-Agent": "skill-hub",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`contents fetch failed ${path}: ${res.status}`);
  }
  return res.text();
}

/**
 * Pull the whole repo tree in ONE request (recursive=1). Returns null on 404
 * (wrong branch) so the caller can retry with the default branch; any other
 * failure (e.g. 403 rate limit) propagates.
 */
async function tryFetchTree(
  repo: string,
  branch: string,
  token: string
): Promise<GhTreeItem[] | null> {
  try {
    const data = await ghFetch<{ tree: GhTreeItem[]; truncated?: boolean }>(
      `${GH_API}/repos/${repo}/git/trees/${branch}?recursive=1`,
      token
    );
    if (data.truncated) {
      console.warn("[github-import] tree truncated, results may be incomplete");
    }
    return data.tree ?? [];
  } catch (e) {
    if (e instanceof Error && /404/.test(e.message)) return null;
    throw e;
  }
}

/** Query GitHub for the repo's default branch name. */
async function getDefaultBranch(repo: string, token: string): Promise<string> {
  const data = await ghFetch<{ default_branch: string }>(
    `${GH_API}/repos/${repo}`,
    token
  );
  return data.default_branch;
}

/** Run an async fn over items with bounded concurrency. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<(R | undefined)[]> {
  const results: (R | undefined)[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        try {
          results[idx] = await fn(items[idx]);
        } catch {
          results[idx] = undefined;
        }
      }
    }
  );
  await Promise.all(workers);
  return results;
}

function isMdFile(name: string): boolean {
  return /\.(md|markdown|txt)$/i.test(name);
}

/**
 * Resolve which directories to import as skills, given the full tree.
 *
 * - If `subPath` is set and points directly at a skill folder (contains .md
 *   files at its top level), only that one skill is imported.
 * - Otherwise we scan `subPath` (or `skills/`, or repo root) for child
 *   directories that look like skills.
 *
 * Returns candidate { slug, fileTreePaths } pairs (raw content not yet fetched).
 */
function resolveCandidates(
  tree: GhTreeItem[],
  subPath: string
): { slug: string; paths: string[] }[] {
  const baseDir = subPath.trim().replace(/^\/+|\/+$/g, "");
  const basePrefix = baseDir ? `${baseDir}/` : "";

  // Case 1: an explicit subPath points at ONE skill directory — import the
  // whole directory (including nested files like reference/, scripts/) as a
  // single skill. Do NOT scan its subdirectories as separate skills.
  if (baseDir) {
    const paths = tree
      .filter((i) => i.type === "blob" && i.path.startsWith(basePrefix))
      .map((i) => i.path);
    if (paths.length === 0) return [];
    const segs = baseDir.split("/").filter(Boolean);
    const slug = segs[segs.length - 1];
    return [{ slug, paths }];
  }

  // Case 2: no subPath → scan skills/ (or repo root) for child skill folders.
  const hasSkills = tree.some((i) => i.path === "skills" && i.type === "tree");
  const scanPrefix = hasSkills ? "skills/" : "";

  const childDirs = new Set<string>();
  for (const item of tree) {
    if (item.type !== "blob") continue;
    if (!item.path.startsWith(scanPrefix)) continue;
    const rest = item.path.slice(scanPrefix.length);
    const segs = rest.split("/");
    if (segs.length >= 2) childDirs.add(segs[0]);
  }

  const candidates: { slug: string; paths: string[] }[] = [];
  for (const dirName of childDirs) {
    const dirPrefix = `${scanPrefix}${dirName}/`;
    const paths = tree
      .filter((i) => i.type === "blob" && i.path.startsWith(dirPrefix))
      .map((i) => i.path);
    // Only treat as a skill if it contains a markdown/text file at any depth.
    if (paths.some((p) => isMdFile(p.slice(dirPrefix.length)))) {
      candidates.push({ slug: dirName, paths });
    }
  }
  return candidates;
}

/**
 * Fetch all skills from a GitHub repo.
 *
 * Uses the Git Trees API once (1 REST request) to enumerate every file path,
 * then downloads each file's body via the Contents API raw media type (1 request
 * per file). The old recursive walker issued one request per directory AND per
 * file; this version drops all the per-directory calls, so importing a single
 * skill costs roughly (1 + fileCount) requests instead of dozens.
 *
 * @param subPath Optional directory path (e.g. "skills/mcp-builder") to import
 *                a single skill instead of scanning the whole repo.
 */
export async function fetchSkillsFromRepo(
  repo: string,
  token: string,
  branch = "main",
  subPath = ""
): Promise<ImportedSkill[]> {
  // 1. One tree fetch (the only metered REST request in the hot path).
  let tree = await tryFetchTree(repo, branch, token);

  // 2. Branch may be wrong — retry once with the default branch.
  if (!tree) {
    try {
      const defaultBranch = await getDefaultBranch(repo, token);
      if (defaultBranch && defaultBranch !== branch) {
        console.log(
          `[github-import] Branch "${branch}" not found, retrying with default "${defaultBranch}"`
        );
        branch = defaultBranch;
        tree = await tryFetchTree(repo, branch, token);
      }
    } catch {
      // fall through to error below
    }
  }

  if (!tree) {
    throw new Error(
      "Could not read repo contents. Check that the repo exists and the branch is correct."
    );
  }

  // 3. Decide which directories are skills.
  const candidates = resolveCandidates(tree, subPath);
  if (candidates.length === 0) {
    throw new Error(
      subPath
        ? `No skill found at "${subPath}". Expected a folder containing a SKILL.md.`
        : "No skills found in the repo's skills/ directory"
    );
  }

  // 4. Download file contents (raw, unmetered) with bounded concurrency.
  const results: ImportedSkill[] = [];

  for (const { slug, paths } of candidates) {
    const dirPrefix = paths[0]?.slice(0, paths[0].lastIndexOf("/") + 1) ?? "";

    const downloaded = await mapPool(
      paths,
      FETCH_CONCURRENCY,
      async (p): Promise<SkillFile | undefined> => {
        const relPath = p.startsWith(dirPrefix)
          ? p.slice(dirPrefix.length)
          : p.slice(p.lastIndexOf("/") + 1);
        try {
          const content = await fetchFileContents(repo, branch, p, token);
          return { filename: relPath, content };
        } catch (e) {
          console.warn(`[github-import] file fetch failed ${p}:`, e);
          return undefined;
        }
      }
    );

    const files = downloaded.filter((f): f is SkillFile => f !== undefined);
    if (files.length === 0) continue;

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
