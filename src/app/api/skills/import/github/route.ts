import { isAuthenticated } from "@/lib/auth";
import { upsertSkillFiles } from "@/lib/storage";
import { GITHUB_CONFIG } from "@/lib/constants";
import { fetchSkillsFromRepo } from "@/lib/github-import";
import { safeError } from "@/lib/api-utils";
import type { ImportGitHubRequest, ImportResult } from "@/lib/types";

export async function POST(request: Request) {
  try {
    if (!isAuthenticated(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as ImportGitHubRequest;
    let branch = body.branch;
    const token = body.token || GITHUB_CONFIG.token;
    const rawInput = (body.repo || "").trim();

    if (!rawInput) {
      return Response.json({ error: "Repository is required (format: owner/repo)" }, { status: 400 });
    }

    // Strip query/hash/.git so URL parsing is clean.
    const input = rawInput.split("?")[0].split("#")[0].replace(/\.git$/, "");

    let repo = "";
    let subPath = "";

    // Full URL with a tree path: github.com/owner/repo/tree/<branch>/<path>
    // → import only the skill at <path> using that branch.
    let m = input.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/);
    if (m) {
      repo = `${m[1]}/${m[2]}`;
      branch = branch || decodeURIComponent(m[3]);
      subPath = decodeURIComponent(m[4]).replace(/^\/+|\/+$/g, "");
    } else {
      // github.com/owner/repo  OR  owner/repo[/optional/sub/path]
      m = input.match(/(?:github\.com\/)?([^/\s]+)\/([^/\s]+)(?:\/(.+))?$/);
      if (m) {
        repo = `${m[1]}/${m[2]}`;
        if (m[3]) subPath = m[3].replace(/^\/+|\/+$/g, "");
      }
    }

    if (!repo) {
      return Response.json({ error: "Invalid repo format. Use: owner/repo or full GitHub URL" }, { status: 400 });
    }

    // Token is optional for public repos
    const effectiveBranch = branch || GITHUB_CONFIG.branch || "main";

    // subPath narrows the import to a single skill directory when the user
    // pointed at one (e.g. .../tree/main/skills/mcp-builder).
    const skills = await fetchSkillsFromRepo(repo, token, effectiveBranch, subPath);

    if (skills.length === 0) {
      return Response.json(
        { error: "No skills found in the repo's skills/ directory" },
        { status: 404 }
      );
    }

    // Import each skill
    const result: ImportResult = { imported: 0, skills: [], errors: [] };

    for (const skill of skills) {
      try {
        upsertSkillFiles(
          skill.slug,
          skill.name,
          skill.description,
          "claude",
          skill.triggers,
          skill.files
        );
        result.imported++;
        result.skills.push({ slug: skill.slug, name: skill.name });
      } catch (e) {
        result.errors.push({
          slug: skill.slug,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return Response.json(result, { status: 201 });
  } catch (e) {
    return safeError(e);
  }
}
