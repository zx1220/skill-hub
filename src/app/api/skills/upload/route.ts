import { isAuthenticated } from "@/lib/auth";
import { upsertSkillFiles } from "@/lib/storage";
import { computeChecksum } from "@/lib/storage";
import { safeError } from "@/lib/api-utils";
import type { SkillFile, AgentType } from "@/lib/types";

export async function POST(request: Request) {
  try {
    if (!isAuthenticated(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const agent = (formData.get("agent") as AgentType) || "claude";
    const slugOverride = formData.get("slug") as string | null;

    // Support both single file ("file") and multiple files ("files")
    const singleFile = formData.get("file") as File | null;
    const multipleFiles = formData.getAll("files") as File[];
    const allFiles = multipleFiles.length > 0 ? multipleFiles : (singleFile ? [singleFile] : []);

    if (allFiles.length === 0) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Reject zip files
    for (const f of allFiles) {
      if (f.name.toLowerCase().endsWith(".zip")) {
        return Response.json(
          { error: "Zip upload not supported. Please upload .md files directly." },
          { status: 400 }
        );
      }
    }

    // Build slug: from override > folder name > first filename
    let slug = slugOverride || "";
    if (!slug && allFiles.length === 1) {
      slug = allFiles[0].name.replace(/\.(md|markdown)$/i, "").toLowerCase()
        .replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    }

    // Read all files
    const skillFiles: SkillFile[] = [];
    for (const f of allFiles) {
      const content = await f.text();
      // Use filename directly; for webkitRelativePath, extract just the filename
      const filename = f.name;
      skillFiles.push({ filename, content });
    }

    // Derive slug from SKILL.md frontmatter if still empty
    const skillMd = skillFiles.find((f) => f.filename === "SKILL.md") || skillFiles[0];
    const fm = extractFrontmatter(skillMd.content);

    if (!slug) {
      slug = fm.name
        ? fm.name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
        : "imported-skill";
    }

    const name = fm.name || slug;
    const description = fm.description || "";

    const checksum = computeChecksum(skillFiles);
    upsertSkillFiles(slug, name, description, agent, [], skillFiles);

    return Response.json({ slug, checksum }, { status: 201 });
  } catch (e) {
    return safeError(e);
  }
}

function extractFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { name: "", description: "" };

  const fm = match[1];
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const descMatch = fm.match(/^description:\s*["']?(.+?)["']?\s*$/m);

  return {
    name: nameMatch?.[1]?.trim() || "",
    description: descMatch?.[1]?.trim() || "",
  };
}
