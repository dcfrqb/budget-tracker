import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getFundById } from "@/lib/data/funds";
import type { FundCreateInput, FundUpdateInput } from "@/lib/validation/fund";
import type { FundContributionInput } from "@/lib/validation/fund-contribution";

// ─────────────────────────────────────────────────────────────
// Fund mutations
// ─────────────────────────────────────────────────────────────

export async function createFund(userId: string, input: FundCreateInput) {
  return db.fund.create({
    data: { ...input, userId },
  });
}

export async function updateFund(
  userId: string,
  id: string,
  input: FundUpdateInput,
) {
  const existing = await getFundById(userId, id);
  if (!existing) throw Object.assign(new Error("fund not found"), { code: "NOT_FOUND" });

  return db.fund.update({ where: { id }, data: input });
}

export async function deleteFund(userId: string, id: string) {
  const existing = await getFundById(userId, id);
  if (!existing) throw Object.assign(new Error("fund not found"), { code: "NOT_FOUND" });

  await db.fund.delete({ where: { id } });
  return { id };
}

export async function contributeFund(
  userId: string,
  id: string,
  input: FundContributionInput,
) {
  const fund = await getFundById(userId, id);
  if (!fund) throw Object.assign(new Error("fund not found"), { code: "NOT_FOUND" });

  if (input.currencyCode !== fund.currencyCode) {
    throw Object.assign(
      new Error(`currency mismatch: expected ${fund.currencyCode}, got ${input.currencyCode}`),
      { code: "INVALID" },
    );
  }

  const account = await db.account.findFirst({
    where: { id: input.accountId, userId, deletedAt: null, isArchived: false },
    select: { id: true },
  });
  if (!account) throw Object.assign(new Error("account not found or archived"), { code: "NOT_FOUND" });

  const amount = new Prisma.Decimal(input.amount);
  const occurredAt = input.occurredAt ?? new Date();

  return db.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        userId,
        accountId: input.accountId,
        kind: "EXPENSE",
        status: "DONE",
        amount,
        currencyCode: input.currencyCode,
        occurredAt,
        name: `Взнос: ${fund.name}`,
        fundId: id,
      },
    });

    const updated = await tx.fund.update({
      where: { id },
      data: { currentAmount: { increment: amount } },
    });

    return { fund: updated, transactionId: transaction.id };
  });
}
