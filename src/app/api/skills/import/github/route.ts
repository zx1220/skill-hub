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
    let { branch } = body;
    const token = body.token || GITHUB_CONFIG.token;
    let repo = (body.repo || "").trim();

    if (!repo) {
      return Response.json({ error: "Repository is required (format: owner/repo)" }, { status: 400 });
    }

    // Extract owner/repo from full GitHub URL if user pastes one
    const urlMatch = repo.match(/github\.com\/([^/]+\/[^/\s]+)/);
    if (urlMatch) {
      repo = urlMatch[1].replace(/\.git$/, "");
    }

    // Validate repo format
    const repoParts = repo.split("/");
    if (repoParts.length !== 2 || !repoParts[0] || !repoParts[1]) {
      return Response.json({ error: "Invalid repo format. Use: owner/repo or full GitHub URL" }, { status: 400 });
    }

    // Token is optional for public repos
    const effectiveBranch = branch || GITHUB_CONFIG.branch || "main";

    // Fetch all skills from the repo
    const skills = await fetchSkillsFromRepo(repo, token, effectiveBranch);

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
