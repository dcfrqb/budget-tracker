import { z } from "zod";
import { Scope, TransactionKind, TransactionStatus } from "@prisma/client";
import { zCuid, zCurrencyCode, zIsoDate, zMoney } from "./shared";

export const transactionCreateSchema = z.object({
  accountId: zCuid,
  categoryId: zCuid.nullish(),
  kind: z.nativeEnum(TransactionKind),
  status: z.nativeEnum(TransactionStatus).optional(),
  amount: zMoney,
  currencyCode: zCurrencyCode,
  occurredAt: zIsoDate,
  plannedAt: zIsoDate.nullish(),
  name: z.string().min(1).max(240),
  note: z.string().max(500).nullish(),
  scope: z.nativeEnum(Scope).optional(),
  familyId: zCuid.nullish(),

  isReimbursable: z.boolean().optional(),
  reimbursementFromName: z.string().max(120).nullish(),
  expectedReimbursement: zMoney.nullish(),

  transferId: zCuid.nullish(),
  loanId: zCuid.nullish(),
  loanPaymentId: zCuid.nullish(),
  subscriptionId: zCuid.nullish(),
  longProjectId: zCuid.nullish(),
  fundId: zCuid.nullish(),
  workSourceId: zCuid.nullish(),
  personalDebtId: zCuid.nullish(),
  plannedEventId: zCuid.nullish(),
});

export const transactionUpdateSchema = transactionCreateSchema.partial();

export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
