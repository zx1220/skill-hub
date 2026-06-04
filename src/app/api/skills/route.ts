import { getSkillRegistry, upsertSkill } from "@/lib/github";
import { GITHUB_CONFIG } from "@/lib/constants";
import type { CreateSkillInput } from "@/lib/types";
import { readFileSync } from "fs";
import { join } from "path";

function getDemoRegistry() {
  try {
    const data = readFileSync(join(process.cwd(), "public/demo-registry.json"), "utf-8");
    return JSON.parse(data);
  } catch {
    return { skills: [], updatedAt: new Date().toISOString() };
  }
}

export async function GET() {
  try {
    // If no GitHub repo or token configured, serve demo data
    if (!GITHUB_CONFIG.repo || !GITHUB_CONFIG.token) {
      return Response.json(getDemoRegistry());
    }
    const registry = await getSkillRegistry();
    return Response.json(registry);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input: CreateSkillInput = await request.json();

    if (!input.name || !input.slug || !input.description || !input.content) {
      return Response.json(
        { error: "name, slug, description, and content are required" },
        { status: 400 }
      );
    }

    if (!GITHUB_CONFIG.repo) {
      return Response.json(
        { error: "GitHub repo not configured. Set NEXT_PUBLIC_SKILL_REPO env var." },
        { status: 503 }
      );
    }

    const result = await upsertSkill(input);
    return Response.json(result, { status: 201 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
