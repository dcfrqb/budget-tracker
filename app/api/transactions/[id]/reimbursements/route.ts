import { Prisma, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { conflict, err, notFound, ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { reimbCreateSchema } from "@/lib/validation/reimbursement";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const txn = await db.transaction.findFirst({
      where: { id, userId: DEFAULT_USER_ID, deletedAt: null },
      select: { id: true },
    });
    if (!txn) return notFound("transaction not found");
    const rows = await db.reimbursementFact.findMany({
      where: { transactionId: id },
      orderBy: { receivedAt: "desc" },
    });
    return ok(rows);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await parseBody(req, reimbCreateSchema);
  if (!body.ok) return body.response;
  const input = body.data;

  try {
    const txn = await db.transaction.findFirst({
      where: { id, userId: DEFAULT_USER_ID, deletedAt: null },
      select: { id: true, isReimbursable: true, status: true },
    });
    if (!txn) return notFound("transaction not found");
    if (!txn.isReimbursable) return conflict("transaction is not reimbursable");
    if (txn.status === TransactionStatus.CANCELLED) {
      return conflict("cannot reimburse a cancelled transaction");
    }

    if (new Prisma.Decimal(input.amount).lte(0)) {
      return err("amount must be positive", 400);
    }

    if (input.accountId) {
      const acc = await db.account.findFirst({
        where: {
          id: input.accountId,
          userId: DEFAULT_USER_ID,
          deletedAt: null,
          isArchived: false,
        },
        select: { id: true },
      });
      if (!acc) return err("account not found or archived", 400);
    }

    const fact = await db.reimbursementFact.create({
      data: {
        transactionId: id,
        amount: input.amount,
        receivedAt: input.receivedAt,
        accountId: input.accountId ?? null,
        note: input.note ?? null,
      },
    });
    return ok(fact, 201);
  } catch (e) {
    return serverError(e);
  }
}
