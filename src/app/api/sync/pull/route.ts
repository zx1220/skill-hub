import { isAuthenticated } from "@/lib/auth";
import { handlePull } from "@/lib/sync";
import { safeError } from "@/lib/api-utils";

export async function GET(request: Request) {
  try {
    if (!isAuthenticated(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const since = url.searchParams.get("since") || undefined;

    const result = handlePull(since);
    return Response.json(result);
  } catch (e) {
    return safeError(e);
  }
}
