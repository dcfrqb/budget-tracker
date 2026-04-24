import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, notFound, err, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { familyMemberCreateSchema } from "@/lib/validation/family-member";

export const dynamic = "force-dynamic";

async function checkFamilyAccess(familyId: string, userId: string) {
  const family = await db.family.findUnique({
    where: { id: familyId },
    include: { members: { select: { userId: true } } },
  });
  if (!family) return null;
  const isMember = family.ownerId === userId ||
    family.members.some((m) => m.userId === userId);
  return isMember ? family : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const family = await checkFamilyAccess(id, userId);
    if (!family) return notFound("family not found or access denied");

    const members = await db.familyMember.findMany({
      where: { familyId: id },
      orderBy: { joinedAt: "asc" },
    });
    return ok(members);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;

    // Только owner может добавлять участников
    const family = await db.family.findUnique({ where: { id } });
    if (!family) return notFound("family not found");
    if (family.ownerId !== userId) return err("forbidden", 403);

    const body = await parseBody(req, familyMemberCreateSchema);
    if (!body.ok) return body.response;

    const member = await db.familyMember.create({
      data: { ...body.data, familyId: id },
    });
    return ok(member, 201);
  } catch (e) {
    return serverError(e);
  }
}
