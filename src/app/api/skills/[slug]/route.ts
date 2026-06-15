import { getSkillDetail, deleteSkill, upsertSkill, hasSkills, updateSkillCategory } from "@/lib/storage";
import { safeError } from "@/lib/api-utils";
import { getDemoSkill } from "@/lib/demo";
import { isAuthenticated } from "@/lib/auth";
import type { CreateSkillInput } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!hasSkills()) {
      const demo = getDemoSkill(slug);
      if (!demo) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json(demo);
    }

    const skill = getSkillDetail(slug);
    if (!skill) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(skill);
  } catch (e) {
    return safeError(e);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    if (!isAuthenticated(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    const input: CreateSkillInput = await request.json();
    input.slug = slug;
    const result = upsertSkill(input);
    return Response.json(result);
  } catch (e) {
    return safeError(e);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    if (!isAuthenticated(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    const body = await request.json();

    if ("category" in body) {
      updateSkillCategory(slug, body.category ?? null);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  } catch (e) {
    return safeError(e);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    if (!isAuthenticated(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    deleteSkill(slug);
    return Response.json({ ok: true });
  } catch (e) {
    return safeError(e);
  }
}
