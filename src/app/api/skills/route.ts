import { getSkillRegistry, upsertSkill } from "@/lib/github";
import { GITHUB_CONFIG } from "@/lib/constants";
import { safeError } from "@/lib/api-utils";
import { getDemoRegistry } from "@/lib/demo";
import type { CreateSkillInput } from "@/lib/types";

export async function GET() {
  try {
    if (!GITHUB_CONFIG.repo || !GITHUB_CONFIG.token) {
      return Response.json(getDemoRegistry());
    }
    const registry = await getSkillRegistry();
    return Response.json(registry);
  } catch (e) {
    return safeError(e);
  }
}

export async function POST(request: Request) {
  try {
    if (!GITHUB_CONFIG.token) {
      return Response.json(
        { error: "Write operations require GITHUB_TOKEN" },
        { status: 401 }
      );
    }

    const input: CreateSkillInput = await request.json();

    if (!input.name || !input.slug || !input.description || !input.content) {
      return Response.json(
        { error: "name, slug, description, and content are required" },
        { status: 400 }
      );
    }

    if (!GITHUB_CONFIG.repo) {
      return Response.json(
        { error: "GitHub repo not configured. Set SKILL_REPO env var." },
        { status: 503 }
      );
    }

    const result = await upsertSkill(input);
    return Response.json(result, { status: 201 });
  } catch (e) {
    return safeError(e);
  }
}
