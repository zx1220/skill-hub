import { isAuthenticated } from "@/lib/auth";
import { listCategories, createCategory } from "@/lib/storage";
import { safeError } from "@/lib/api-utils";

/** GET: List all categories */
export async function GET(request: Request) {
  try {
    if (!isAuthenticated(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const categories = listCategories();
    return Response.json(categories);
  } catch (e) {
    return safeError(e);
  }
}

/** POST: Create a new category */
export async function POST(request: Request) {
  try {
    if (!isAuthenticated(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, sortOrder } = await request.json() as { name: string; sortOrder?: number };
    if (!name?.trim()) {
      return Response.json({ error: "Category name is required" }, { status: 400 });
    }

    createCategory(name.trim(), sortOrder);
    return Response.json({ ok: true, name: name.trim() }, { status: 201 });
  } catch (e) {
    return safeError(e);
  }
}
