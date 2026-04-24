import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, err, notFound, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { categoryUpdateSchema } from "@/lib/validation/category";
import { getCategoryById } from "@/lib/data/categories";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const category = await getCategoryById(userId, id);
    if (!category) return notFound("category not found");
    return ok(category);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;

    const existing = await getCategoryById(userId, id);
    if (!existing) return notFound("category not found");

    const body = await parseBody(req, categoryUpdateSchema);
    if (!body.ok) return body.response;

    const updated = await db.category.update({
      where: { id },
      data: body.data,
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;

    const existing = await getCategoryById(userId, id);
    if (!existing) return notFound("category not found");
    if (existing.archivedAt) return err("already archived", 400);

    await db.category.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    return ok({ id });
  } catch (e) {
    return serverError(e);
  }
}
