import { isAuthenticated } from "@/lib/auth";
import { upsertSkillFiles } from "@/lib/storage";
import { safeError } from "@/lib/api-utils";
import type { AgentType, SkillFile } from "@/lib/types";

export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated(request))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { url, agent } = body as { url: string; agent?: AgentType };

    if (!url) {
      return Response.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return Response.json({ error: "Invalid URL format" }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return Response.json({ error: "Only HTTP(S) URLs are supported" }, { status: 400 });
    }

    // Fetch content from URL with 15s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "skill-hub/import" },
      });
    } catch (e) {
      return Response.json(
        { error: e instanceof Error && e.name === "AbortError" ? "Request timed out (15s)" : "Failed to fetch URL" },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return Response.json(
        { error: `Remote returned ${response.status} ${response.statusText}` },
        { status: 502 }
      );
    }

    const content = await response.text();
    if (!content.trim()) {
      return Response.json({ error: "Fetched content is empty" }, { status: 400 });
    }

    // Parse frontmatter for metadata
    const fm = parseFrontmatter(content);

    // Derive slug: from frontmatter name > URL filename > "imported-skill"
    let slug: string;
    if (fm.name) {
      slug = fm.name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    } else {
      const urlFilename = parsedUrl.pathname.split("/").pop() || "";
      slug = urlFilename.replace(/\.(md|markdown|txt)$/i, "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    }

    if (!slug) {
      slug = "imported-skill";
    }

    const name = fm.name || slug;
    const description = fm.description || "";
    const triggers = fm.triggers || [];
    const effectiveAgent = agent || "claude";

    const files: SkillFile[] = [{ filename: "SKILL.md", content }];

    const result = await upsertSkillFiles(slug, name, description, effectiveAgent, triggers, files);

    return Response.json({ slug: result.slug, checksum: result.checksum }, { status: 201 });
  } catch (e) {
    return safeError(e);
  }
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
