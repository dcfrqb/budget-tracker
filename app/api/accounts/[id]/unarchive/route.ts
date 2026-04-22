import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { notFound, ok, serverError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const existing = await db.account.findFirst({
      where: { id, userId: DEFAULT_USER_ID, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return notFound("account not found");

    const updated = await db.account.update({
      where: { id },
      data: { isArchived: false, archivedAt: null },
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
