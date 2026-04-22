import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { conflict, notFound, ok, serverError } from "@/lib/api/response";
import { dbDirectionToApi } from "@/lib/validation/debt";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const existing = await db.personalDebt.findFirst({
      where: { id, userId: DEFAULT_USER_ID },
      select: { id: true, closedAt: true },
    });
    if (!existing) return notFound("personal debt not found");
    if (!existing.closedAt) return conflict("debt is already open");
    const updated = await db.personalDebt.update({
      where: { id },
      data: { closedAt: null },
    });
    return ok({ ...updated, direction: dbDirectionToApi(updated.direction) });
  } catch (e) {
    return serverError(e);
  }
}
