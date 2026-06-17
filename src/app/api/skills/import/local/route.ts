import { isAuthenticated } from "@/lib/auth";
import { upsertSkillFiles } from "@/lib/storage";
import { safeError } from "@/lib/api-utils";
import { collectFilesRecursive, parseFrontmatter, getLocalSkillDir } from "@/lib/local-scanner";
import type { LocalSkillScan, ImportLocalRequest, ImportResult, SkillFile, LocalSyncAgent } from "@/lib/types";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/** GET: Scan local filesystem for installed skills */
export async function GET(request: Request) {
  try {
    if (!(await isAuthenticated(request))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agents: LocalSyncAgent[] = ["claude", "hermes"];
    const skills: LocalSkillScan[] = [];

    for (const source of agents) {
      const dirPath = getLocalSkillDir(source);
      if (!existsSync(dirPath)) continue;

      const entries = collectFilesRecursive(dirPath);
      // Group by top-level directory
      const skillDirs = new Set<string>();
      for (const file of entries) {
        const topDir = file.split("/")[0];
        if (topDir) skillDirs.add(topDir);
      }

      for (const entry of skillDirs) {
        const fullPath = join(dirPath, entry);
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

        skills.push({
          slug: entry,
          name,
          description,
          source,
          path: fullPath,
          files,
        });
      }
    }

    return Response.json({ skills });
  } catch (e) {
    return safeError(e);
  }
}

/** POST: Import selected local skills into the hub */
export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated(request))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as ImportLocalRequest;

    if (!body.skills?.length) {
      return Response.json({ error: "No skills selected" }, { status: 400 });
    }

    const result: ImportResult = { imported: 0, skills: [], errors: [] };

    for (const { slug, source } of body.skills) {
      try {
        const dirPath = join(getLocalSkillDir(source as LocalSyncAgent), slug);

        if (!existsSync(dirPath)) {
          result.errors.push({ slug, error: "Directory not found" });
          continue;
        }

        // Read all files recursively (including subfolders)
        const entries = collectFilesRecursive(dirPath);

        const files: SkillFile[] = [];
        for (const entry of entries) {
          const content = readFileSync(join(dirPath, entry), "utf-8");
          files.push({ filename: entry, content });
        }

        if (files.length === 0) {
          result.errors.push({ slug, error: "No files found" });
          continue;
        }

        // Parse metadata from SKILL.md
        const skillMd = files.find((f) => f.filename === "SKILL.md");
        const fm = parseFrontmatter(skillMd?.content || "");

        const name = fm.name || slug;
        const description = fm.description || "";
        const triggers = fm.triggers || [];
        const agent: "claude" | "hermes" | "both" = source;

        await upsertSkillFiles(slug, name, description, agent, triggers, files);

        result.imported++;
        result.skills.push({ slug, name });
      } catch (e) {
        result.errors.push({
          slug,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return Response.json(result, { status: 201 });
  } catch (e) {
    return safeError(e);
  }
}
