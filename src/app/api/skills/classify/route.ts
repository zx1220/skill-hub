import { isAuthenticated } from "@/lib/auth";
import { listUncategorizedSkills, listSkills, batchUpdateCategories } from "@/lib/storage";
import { classifySkills } from "@/lib/classify";
import { safeError } from "@/lib/api-utils";

/** POST: Rule-based skill classification (incremental by default, ?force=true for all) */
export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated(request))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";

    const skills = force ? await listSkills() : await listUncategorizedSkills();
    if (skills.length === 0) {
      return Response.json({
        classified: 0,
        categories: {},
        message: force ? "No skills found" : "All skills already classified",
      });
    }

    const classification = classifySkills(skills);
    const updated = await batchUpdateCategories(classification);

    return Response.json({
      classified: updated,
      categories: classification,
    });
  } catch (e) {
    return safeError(e);
  }
}
