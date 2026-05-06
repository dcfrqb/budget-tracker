"use server";

import { TransactionKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getLatestRatesMap } from "@/lib/data/wallet";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/api/auth";

type MarkResult =
  | { ok: true; transferId: string }
  | { ok: true; transferId: string; warning: string }
  | { ok: false; error: string };

type BreakResult = { ok: true } | { ok: false; error: string };

export async function markPairAsTransfer(args: {
  leftId: string;
  rightId: string;
}): Promise<MarkResult> {
  const userId = await getCurrentUserId();
  const { leftId, rightId } = args;

  const [left, right] = await Promise.all([
    db.transaction.findFirst({
      where: { id: leftId, userId, deletedAt: null },
      select: { id: true, userId: true, accountId: true, kind: true, transferId: true, amount: true, currencyCode: true, occurredAt: true },
    }),
    db.transaction.findFirst({
      where: { id: rightId, userId, deletedAt: null },
      select: { id: true, userId: true, accountId: true, kind: true, transferId: true, amount: true, currencyCode: true, occurredAt: true },
    }),
  ]);

  if (!left || !right) {
    return { ok: false, error: "transactions.selection.error.transfer_not_found" };
  }

  if (left.transferId !== null || right.transferId !== null) {
    return { ok: false, error: "transactions.selection.tooltip.already_transfer" };
  }

  if (left.accountId === right.accountId) {
    return { ok: false, error: "transactions.selection.tooltip.same_account" };
  }

  let fromTxn: typeof left;
  let toTxn: typeof right;

  const leftKind = left.kind;
  const rightKind = right.kind;

  if (leftKind === rightKind) {
    return { ok: false, error: "transactions.selection.error.same_kind" };
  }

  if (leftKind === TransactionKind.EXPENSE) {
    fromTxn = left;
    toTxn = right;
  } else if (rightKind === TransactionKind.EXPENSE) {
    fromTxn = right;
    toTxn = left;
  } else {
    return { ok: false, error: "transactions.selection.error.same_kind" };
  }

  let rate = new Prisma.Decimal(1);
  let rateMissing = false;

  if (fromTxn.currencyCode !== toTxn.currencyCode) {
    const ratesMap = await getLatestRatesMap();
    const directKey = `${fromTxn.currencyCode}-${toTxn.currencyCode}`;
    const inverseKey = `${toTxn.currencyCode}-${fromTxn.currencyCode}`;

    const direct = ratesMap.get(directKey);
    if (direct) {
      rate = direct;
    } else {
      const inverse = ratesMap.get(inverseKey);
      if (inverse && !inverse.isZero()) {
        rate = new Prisma.Decimal(1).div(inverse);
      } else {
        rateMissing = true;
      }
    }
  }

  const occurredAt =
    fromTxn.occurredAt < toTxn.occurredAt ? fromTxn.occurredAt : toTxn.occurredAt;

  let transferId: string;
  try {
    const result = await db.$transaction(async (tx) => {
      const created = await tx.transfer.create({
        data: {
          userId,
          fromAccountId: fromTxn.accountId,
          toAccountId: toTxn.accountId,
          fromAmount: fromTxn.amount,
          toAmount: toTxn.amount,
          fromCcy: fromTxn.currencyCode,
          toCcy: toTxn.currencyCode,
          rate,
          occurredAt,
          note: "manual-paired",
        },
      });
      await tx.transaction.updateMany({
        where: { id: { in: [fromTxn.id, toTxn.id] } },
        data: { kind: TransactionKind.TRANSFER, transferId: created.id },
      });
      return created.id;
    });
    transferId = result;
  } catch {
    return { ok: false, error: "transactions.selection.error.transfer_not_found" };
  }

  revalidatePath("/transactions");

  if (rateMissing) {
    return { ok: true, transferId, warning: "transactions.selection.error.rate_missing" };
  }

  return { ok: true, transferId };
}

export async function breakTransfer(args: {
  transferId: string;
}): Promise<BreakResult> {
  const userId = await getCurrentUserId();
  const { transferId } = args;

  const transfer = await db.transfer.findFirst({
    where: { id: transferId, userId },
    include: { transactions: { select: { id: true, accountId: true } } },
  });

  if (!transfer) {
    return { ok: false, error: "transactions.selection.error.transfer_not_found" };
  }

  const fromLeg = transfer.transactions.find(
    (t) => t.accountId === transfer.fromAccountId,
  );
  const toLeg = transfer.transactions.find(
    (t) => t.accountId === transfer.toAccountId,
  );

  try {
    await db.$transaction(async (tx) => {
      if (fromLeg) {
        await tx.transaction.update({
          where: { id: fromLeg.id },
          data: { kind: TransactionKind.EXPENSE, transferId: null },
        });
      }
      if (toLeg) {
        await tx.transaction.update({
          where: { id: toLeg.id },
          data: { kind: TransactionKind.INCOME, transferId: null },
        });
      }
      const otherLegs = transfer.transactions.filter(
        (t) => t.id !== fromLeg?.id && t.id !== toLeg?.id,
      );
      for (const leg of otherLegs) {
        await tx.transaction.update({
          where: { id: leg.id },
          data: { kind: TransactionKind.INCOME, transferId: null },
        });
      }
      await tx.transfer.delete({ where: { id: transferId } });
    });
  } catch {
    return { ok: false, error: "transactions.selection.error.transfer_not_found" };
  }

  revalidatePath("/transactions");
  return { ok: true };
}
