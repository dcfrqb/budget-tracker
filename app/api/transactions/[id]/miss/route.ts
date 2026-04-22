import { TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { conflict, notFound, ok, serverError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const txn = await db.transaction.findFirst({
      where: { id, userId: DEFAULT_USER_ID, deletedAt: null },
      select: { status: true },
    });
    if (!txn) return notFound("transaction not found");
    if (txn.status !== TransactionStatus.PLANNED) {
      return conflict(`cannot mark missed from status ${txn.status}`);
    }
    const updated = await db.transaction.update({
      where: { id },
      data: { status: TransactionStatus.MISSED },
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
