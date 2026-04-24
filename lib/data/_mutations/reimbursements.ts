import { db } from "@/lib/db";
import { z } from "zod";
import { zCuid, zIsoDate, zMoney } from "@/lib/validation/shared";

// ─────────────────────────────────────────────────────────────
// Validation schema
// ─────────────────────────────────────────────────────────────

export const reimbursementCreateSchema = z.object({
  amount: zMoney,
  receivedAt: zIsoDate,
  accountId: zCuid.optional(),
  note: z.string().max(500).nullish(),
});

export type ReimbursementCreateInput = z.infer<typeof reimbursementCreateSchema>;

// ─────────────────────────────────────────────────────────────
// Create a ReimbursementFact for a given transaction
// ─────────────────────────────────────────────────────────────

export async function createReimbursement(
  userId: string,
  transactionId: string,
  input: ReimbursementCreateInput,
) {
  // Verify transaction exists and belongs to user and is reimbursable
  const tx = await db.transaction.findFirst({
    where: { id: transactionId, userId, deletedAt: null },
    select: { id: true, isReimbursable: true },
  });
  if (!tx) throw Object.assign(new Error("transaction not found"), { code: "NOT_FOUND" });
  if (!tx.isReimbursable) {
    throw Object.assign(new Error("transaction is not reimbursable"), { code: "CONFLICT" });
  }

  // Optionally verify accountId belongs to user
  if (input.accountId) {
    const acc = await db.account.findFirst({
      where: { id: input.accountId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!acc)
      throw Object.assign(new Error("account not found"), { code: "NOT_FOUND" });
  }

  return db.reimbursementFact.create({
    data: {
      transactionId,
      amount: input.amount,
      receivedAt: input.receivedAt,
      accountId: input.accountId ?? null,
      note: input.note ?? null,
    },
  });
}
