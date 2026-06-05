import { getSkillDetail, deleteSkill, upsertSkill } from "@/lib/github";
import { GITHUB_CONFIG } from "@/lib/constants";
import { safeError } from "@/lib/api-utils";
import { getDemoSkill } from "@/lib/demo";
import type { CreateSkillInput } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!GITHUB_CONFIG.repo || !GITHUB_CONFIG.token) {
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
    if (!GITHUB_CONFIG.token) {
      return Response.json(
        { error: "Write operations require GITHUB_TOKEN" },
        { status: 401 }
      );
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    if (!GITHUB_CONFIG.token) {
      return Response.json(
        { error: "Write operations require GITHUB_TOKEN" },
        { status: 401 }
      );
    }

    const { slug } = await params;
    await deleteSkill(slug);
    return Response.json({ ok: true });
  } catch (e) {
    return safeError(e);
  }
}
