import { isAuthenticated } from "@/lib/auth";
import { getSkillFiles } from "@/lib/storage";
import { safeError } from "@/lib/api-utils";
import { getLocalSkillDir } from "@/lib/local-scanner";
import type { LocalSyncAgent, LocalSyncInstallResponse, SkillFile } from "@/lib/types";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";

/** POST: Install Hub skills to local agent directory */
export async function POST(request: Request) {
  try {
    if (!isAuthenticated(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as { agent: LocalSyncAgent; slugs: string[] };
    const { agent, slugs } = body;

    if (agent !== "claude" && agent !== "hermes") {
      return Response.json({ error: "Invalid agent" }, { status: 400 });
    }

    if (!slugs?.length) {
      return Response.json({ error: "No slugs provided" }, { status: 400 });
    }

    const baseDir = resolve(getLocalSkillDir(agent));

    // Ensure base directory exists
    if (!existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true });
    }

    const result: LocalSyncInstallResponse = { installed: 0, errors: [] };

    for (const slug of slugs) {
      try {
        // Security: prevent path traversal
        if (slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
          result.errors.push({ slug, error: "Invalid slug" });
          continue;
        }

        const skillDir = resolve(join(baseDir, slug));
        if (!skillDir.startsWith(baseDir)) {
          result.errors.push({ slug, error: "Path traversal detected" });
          continue;
        }

        // Get files from Hub
        const files: SkillFile[] = getSkillFiles(slug);
        if (files.length === 0) {
          result.errors.push({ slug, error: "Skill not found in Hub" });
          continue;
        }

        // Create skill directory
        mkdirSync(skillDir, { recursive: true });

        // Write each file
        for (const file of files) {
          const filePath = join(skillDir, file.filename);
          const fileDir = dirname(filePath);

          // Security: ensure file path stays within skill directory
          const resolvedFilePath = resolve(filePath);
          if (!resolvedFilePath.startsWith(skillDir)) {
            continue;
          }

          if (!existsSync(fileDir)) {
            mkdirSync(fileDir, { recursive: true });
          }
          writeFileSync(filePath, file.content, "utf-8");
        }

        result.installed++;
      } catch (e) {
        result.errors.push({
          slug,
          error: e instanceof Error ? e.message : "Install failed",
        });
      }
    }

    return Response.json(result);
  } catch (e) {
    return safeError(e);
  }
}
