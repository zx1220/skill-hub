import { isAuthenticated } from "@/lib/auth";
import { handlePush } from "@/lib/sync";
import { safeError } from "@/lib/api-utils";
import type { SyncPushRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated(request))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data: SyncPushRequest = await request.json();

    if (!data.slug || !data.files || !data.checksum) {
      return Response.json(
        { error: "slug, files, and checksum are required" },
        { status: 400 }
      );
    }

    const result = await handlePush(data);

    if (result.conflict) {
      return Response.json(
        { error: "Conflict: server version differs", checksum: result.checksum },
        { status: 409 }
      );
    }

    return Response.json(result);
  } catch (e) {
    return safeError(e);
  }
}
