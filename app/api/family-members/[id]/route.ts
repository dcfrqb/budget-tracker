import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, notFound, conflict, err, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { familyMemberUpdateSchema } from "@/lib/validation/family-member";

export const dynamic = "force-dynamic";

async function findMember(id: string) {
  return db.familyMember.findFirst({
    where: { id },
    include: { family: { select: { ownerId: true } } },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const member = await findMember(id);
    if (!member) return notFound("family member not found");

    // Только owner семьи может редактировать участников
    if (member.family.ownerId !== userId) return err("forbidden", 403);

    const body = await parseBody(req, familyMemberUpdateSchema);
    if (!body.ok) return body.response;

    const updated = await db.familyMember.update({
      where: { id },
      data: body.data,
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

// Нельзя удалить owner'а
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const member = await findMember(id);
    if (!member) return notFound("family member not found");

    // Только owner семьи может удалять участников
    if (member.family.ownerId !== userId) return err("forbidden", 403);

    // Нельзя удалить owner'а
    if (member.role === "OWNER") {
      return conflict("cannot remove owner from family");
    }

    await db.familyMember.delete({ where: { id } });
    return ok({ id });
  } catch (e) {
    return serverError(e);
  }
}
