import { Prisma, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { conflict, err, notFound, ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { transactionConfirmSchema } from "@/lib/validation/transaction";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await parseBody(req, transactionConfirmSchema);
  if (!body.ok) return body.response;

  try {
    const txn = await db.transaction.findFirst({
      where: { id, userId: DEFAULT_USER_ID, deletedAt: null },
      include: { facts: true },
    });
    if (!txn) return notFound("transaction not found");

    if (
      txn.status !== TransactionStatus.PLANNED &&
      txn.status !== TransactionStatus.PARTIAL
    ) {
      return conflict(`cannot confirm from status ${txn.status}`);
    }

    const planned = new Prisma.Decimal(txn.amount);
    const already = txn.facts.reduce(
      (acc, f) => acc.plus(f.amount),
      new Prisma.Decimal(0),
    );
    const remaining = planned.minus(already);

    const factAmount =
      body.data.amount !== undefined
        ? new Prisma.Decimal(body.data.amount)
        : remaining;

    if (factAmount.lte(0)) return err("amount must be positive", 400);
    if (factAmount.gt(remaining)) {
      return err(
        `amount exceeds remaining ${remaining.toFixed(2)} (planned ${planned.toFixed(2)}, already confirmed ${already.toFixed(2)})`,
        400,
      );
    }

    const newTotal = already.plus(factAmount);
    const nextStatus = newTotal.gte(planned)
      ? TransactionStatus.DONE
      : TransactionStatus.PARTIAL;
    const factDate = body.data.occurredAt ?? new Date();

    const [, updated] = await db.$transaction([
      db.transactionFact.create({
        data: {
          transactionId: id,
          amount: factAmount,
          occurredAt: factDate,
          note: body.data.note ?? null,
        },
      }),
      db.transaction.update({
        where: { id },
        data: { status: nextStatus },
        include: { facts: { orderBy: { occurredAt: "desc" } } },
      }),
    ]);

    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
