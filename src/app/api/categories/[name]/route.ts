import { isAuthenticated } from "@/lib/auth";
import { updateCategory, deleteCategory } from "@/lib/storage";
import { safeError } from "@/lib/api-utils";

/** PUT: Rename a category */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    if (!(await isAuthenticated(request))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name: oldName } = await params;
    const { newName } = await request.json() as { newName: string };
    if (!newName?.trim()) {
      return Response.json({ error: "New name is required" }, { status: 400 });
    }

    const changes = await updateCategory(decodeURIComponent(oldName), newName.trim());
    if (changes === 0) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return safeError(e);
  }
}

/** DELETE: Delete a category (skills become uncategorized) */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    if (!(await isAuthenticated(request))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await params;
    const changes = await deleteCategory(decodeURIComponent(name));
    if (changes === 0) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return safeError(e);
  }
}
