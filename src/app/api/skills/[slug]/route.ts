import { getSkillDetail, deleteSkill, upsertSkill } from "@/lib/github";
import { GITHUB_CONFIG } from "@/lib/constants";
import type { CreateSkillInput, SkillDetail } from "@/lib/types";
import { readFileSync } from "fs";
import { join } from "path";

function getDemoSkill(slug: string): SkillDetail | null {
  try {
    const data = readFileSync(join(process.cwd(), "public/demo-registry.json"), "utf-8");
    const registry = JSON.parse(data);
    const skill = registry.skills?.find((s: { slug: string }) => s.slug === slug);
    if (!skill) return null;

    const agent = skill.agent || "claude";
    const installCmd =
      agent === "hermes"
        ? `skill-sync install ${slug} --agent hermes`
        : agent === "both"
          ? `skill-sync install ${slug} --agent claude\nskill-sync install ${slug} --agent hermes`
          : `skill-sync install ${slug} --agent claude`;

    return {
      ...skill,
      content: `---\nname: ${skill.name}\ndescription: "${skill.description}"\n---\n\n# ${skill.name}\n\n${skill.description}`,
      installCmd,
    };
  } catch {
    return null;
  }
}

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
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const input: CreateSkillInput = await request.json();
    input.slug = slug;
    const result = await upsertSkill(input);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    await deleteSkill(slug);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
