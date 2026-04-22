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

  // transferId умышленно запрещён на create — переводы делаются через /api/transfers.
  loanId: zCuid.nullish(),
  loanPaymentId: zCuid.nullish(),
  subscriptionId: zCuid.nullish(),
  longProjectId: zCuid.nullish(),
  fundId: zCuid.nullish(),
  workSourceId: zCuid.nullish(),
  personalDebtId: zCuid.nullish(),
  plannedEventId: zCuid.nullish(),
});

// На update — kind/status/transferId менять нельзя (status через отдельные endpoint'ы).
export const transactionUpdateSchema = transactionCreateSchema
  .omit({ accountId: true, kind: true, status: true })
  .partial();

export const transactionConfirmSchema = z.object({
  amount: zMoney.optional(),
  occurredAt: zIsoDate.optional(),
  note: z.string().max(500).nullish(),
});

// Query-params для GET /api/transactions. CSV-листы разбиваем в .transform().
const csvEnum = <T extends Record<string, string>>(e: T) =>
  z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return undefined;
      const values = Object.values(e) as string[];
      return s
        .split(",")
        .map((x) => x.trim())
        .filter((x) => values.includes(x)) as Array<T[keyof T]>;
    });

export const transactionListQuerySchema = z.object({
  from: z.string().optional().transform((s) => (s ? new Date(s) : undefined)),
  to: z.string().optional().transform((s) => (s ? new Date(s) : undefined)),
  kind: csvEnum(TransactionKind),
  status: csvEnum(TransactionStatus),
  accountId: zCuid.optional(),
  categoryId: zCuid.optional(),
  reimbursable: z
    .enum(["true", "false"])
    .optional()
    .transform((s) => (s === undefined ? undefined : s === "true")),
  q: z.string().optional(),
  groupBy: z.enum(["day"]).optional(),
  cursor: zCuid.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
export type TransactionConfirmInput = z.infer<typeof transactionConfirmSchema>;
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;
