import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { familyCreateSchema } from "@/lib/validation/family";
import { getUserFamily } from "@/lib/data/families";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const family = await getUserFamily(userId);
    return ok(family);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const body = await parseBody(req, familyCreateSchema);
    if (!body.ok) return body.response;

    // Создаём семью + добавляем текущего юзера как owner-члена
    const family = await db.$transaction(async (tx) => {
      const created = await tx.family.create({
        data: {
          ...body.data,
          ownerId: userId,
        },
      });

      await tx.familyMember.create({
        data: {
          familyId: created.id,
          userId,
          displayName: "Owner",
          role: "OWNER",
        },
      });

      return created;
    });

    return ok(family, 201);
  } catch (e) {
    return serverError(e);
  }
}
