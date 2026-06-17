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

    if (!(await hasSkills())) {
      const demo = getDemoSkill(slug);
      if (!demo) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json(demo);
    }

    const skill = await getSkillDetail(slug);
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
    if (!(await isAuthenticated(request))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    const input: CreateSkillInput = await request.json();
    input.slug = slug;
    const result = await upsertSkill(input);
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
    if (!(await isAuthenticated(request))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    const body = await request.json();

    if ("category" in body) {
      const affected = await updateSkillCategory(slug, body.category ?? null);
      if (affected === 0) {
        return Response.json(
          { error: "技能不存在，可能是演示数据（只读）" },
          { status: 404 }
        );
      }
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
    if (!(await isAuthenticated(request))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    await deleteSkill(slug);
    return Response.json({ ok: true });
  } catch (e) {
    return safeError(e);
  }
}
