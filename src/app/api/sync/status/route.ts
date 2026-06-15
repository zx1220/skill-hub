import { isAuthenticated } from "@/lib/auth";
import { getSyncStatus } from "@/lib/sync";
import { safeError } from "@/lib/api-utils";

export async function GET(request: Request) {
  try {
    if (!isAuthenticated(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = getSyncStatus();
    return Response.json(status);
  } catch (e) {
    return safeError(e);
  }
}
