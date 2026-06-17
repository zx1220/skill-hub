import { getSkillRegistry, upsertSkill, hasSkills } from "@/lib/storage";
import { safeError } from "@/lib/api-utils";
import { getDemoRegistry } from "@/lib/demo";
import { isAuthenticated } from "@/lib/auth";
import type { CreateSkillInput } from "@/lib/types";

export async function GET() {
  try {
    // Use demo data only when database is empty
    if (!(await hasSkills())) {
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
    if (!(await isAuthenticated(request))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const input: CreateSkillInput = await request.json();

    if (!input.name || !input.slug || !input.description || !input.content) {
      return Response.json(
        { error: "name, slug, description, and content are required" },
        { status: 400 }
      );
    }

    const result = await upsertSkill(input);
    return Response.json(result, { status: 201 });
  } catch (e) {
    return safeError(e);
  }
}
