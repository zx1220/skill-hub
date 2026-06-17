import { isAuthenticated } from "@/lib/auth";
import { safeError } from "@/lib/api-utils";
import { getLocalSkillDir } from "@/lib/local-scanner";
import type { LocalSyncAgent, LocalSyncDeleteResponse } from "@/lib/types";
import { rmSync, existsSync } from "fs";
import { join, resolve } from "path";

/** POST: Delete selected local skill folders */
export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated(request))) {
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
    const result: LocalSyncDeleteResponse = { deleted: 0, errors: [] };

    for (const slug of slugs) {
      try {
        // Security: prevent path traversal
        if (slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
          result.errors.push({ slug, error: "Invalid slug" });
          continue;
        }

        const targetPath = resolve(join(baseDir, slug));
        if (!targetPath.startsWith(baseDir)) {
          result.errors.push({ slug, error: "Path traversal detected" });
          continue;
        }

        if (!existsSync(targetPath)) {
          result.errors.push({ slug, error: "Directory not found" });
          continue;
        }

        rmSync(targetPath, { recursive: true, force: true });
        result.deleted++;
      } catch (e) {
        result.errors.push({
          slug,
          error: e instanceof Error ? e.message : "Delete failed",
        });
      }
    }

    return Response.json(result);
  } catch (e) {
    return safeError(e);
  }
}
