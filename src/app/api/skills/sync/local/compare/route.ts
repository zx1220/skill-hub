import { isAuthenticated } from "@/lib/auth";
import { listSkills } from "@/lib/storage";
import { safeError } from "@/lib/api-utils";
import { scanLocalSkills } from "@/lib/local-scanner";
import type { LocalSyncAgent, LocalSyncCompareResponse } from "@/lib/types";

/** POST: Compare Hub skills vs local skills for a given agent */
export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated(request))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as { agent: LocalSyncAgent };
    const agent = body.agent;

    if (agent !== "claude" && agent !== "hermes") {
      return Response.json({ error: "Invalid agent" }, { status: 400 });
    }

    // Get Hub skills relevant to this agent
    const allHubSkills = await listSkills();
    const hubSkills = allHubSkills.filter(
      (s) => s.agent === agent || s.agent === "both"
    );

    // Scan local directory
    const localSkills = scanLocalSkills(agent);

    // Build slug sets
    const hubSlugs = new Map(hubSkills.map((s) => [s.slug, s]));
    const localSlugs = new Map(localSkills.map((s) => [s.slug, s]));

    const localOnly: LocalSyncCompareResponse["localOnly"] = [];
    const hubOnly: LocalSyncCompareResponse["hubOnly"] = [];
    const synced: LocalSyncCompareResponse["synced"] = [];

    // Local-only: in local but not in hub
    for (const [slug, skill] of localSlugs) {
      if (!hubSlugs.has(slug)) {
        localOnly.push({
          slug,
          name: skill.name,
          description: skill.description,
          path: skill.path,
        });
      } else {
        synced.push({ slug, name: skill.name });
      }
    }

    // Hub-only: in hub but not in local
    for (const [slug, skill] of hubSlugs) {
      if (!localSlugs.has(slug)) {
        hubOnly.push({
          slug,
          name: skill.name,
          description: skill.description,
          agent: skill.agent,
          version: skill.version,
        });
      }
    }

    return Response.json({
      agent,
      localOnly,
      hubOnly,
      synced,
    } satisfies LocalSyncCompareResponse);
  } catch (e) {
    return safeError(e);
  }
}
