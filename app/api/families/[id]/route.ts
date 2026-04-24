import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, notFound, err, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { familyUpdateSchema } from "@/lib/validation/family";
import { getFamilyWithMembers } from "@/lib/data/families";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const family = await getFamilyWithMembers(id);
    if (!family) return notFound("family not found");

    // Проверяем доступ: owner или member
    const isMember = family.ownerId === userId ||
      family.members.some((m) => m.userId === userId);
    if (!isMember) return err("forbidden", 403);

    return ok(family);
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
    const family = await db.family.findUnique({ where: { id } });
    if (!family) return notFound("family not found");
    if (family.ownerId !== userId) return err("forbidden", 403);

    const body = await parseBody(req, familyUpdateSchema);
    if (!body.ok) return body.response;

    const updated = await db.family.update({
      where: { id },
      data: body.data,
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

// Только owner может удалить семью
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const family = await db.family.findUnique({ where: { id } });
    if (!family) return notFound("family not found");
    if (family.ownerId !== userId) return err("forbidden", 403);

    await db.family.delete({ where: { id } });
    return ok({ id });
  } catch (e) {
    return serverError(e);
  }
}
