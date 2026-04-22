import { z } from "zod";
import { DebtDirection, TransactionStatus } from "@prisma/client";
import { zCuid, zCurrencyCode, zIsoDate, zMoney } from "./shared";

// API-уровень direction: OUT (я дал) / IN (мне дали).
// В БД хранится как LENT / BORROWED — маппинг в хендлерах.
const zApiDirection = z.enum(["OUT", "IN"]);

export function apiDirectionToDb(d: "OUT" | "IN"): DebtDirection {
  return d === "OUT" ? DebtDirection.LENT : DebtDirection.BORROWED;
}

export function dbDirectionToApi(d: DebtDirection): "OUT" | "IN" {
  return d === DebtDirection.LENT ? "OUT" : "IN";
}

export const debtCreateSchema = z.object({
  direction: zApiDirection,
  counterparty: z.string().min(1).max(120),
  principal: zMoney,
  currencyCode: zCurrencyCode,
  openedAt: zIsoDate,
  dueAt: zIsoDate.nullish(),
  note: z.string().max(500).nullish(),
  initialTransfer: z
    .object({
      accountId: zCuid,
      occurredAt: zIsoDate.optional(),
    })
    .nullish(),
});

export const debtUpdateSchema = z.object({
  counterparty: z.string().min(1).max(120).optional(),
  principal: zMoney.optional(),
  dueAt: zIsoDate.nullish(),
  note: z.string().max(500).nullish(),
});

export const debtListQuerySchema = z.object({
  direction: zApiDirection.optional(),
  status: z.enum(["open", "closed", "all"]).default("open"),
});

export const debtPaymentCreateSchema = z.object({
  amount: zMoney,
  accountId: zCuid,
  occurredAt: zIsoDate,
  status: z
    .enum([TransactionStatus.DONE, TransactionStatus.PLANNED, TransactionStatus.PARTIAL])
    .default(TransactionStatus.DONE),
  note: z.string().max(500).nullish(),
});

export type DebtCreateInput = z.infer<typeof debtCreateSchema>;
export type DebtUpdateInput = z.infer<typeof debtUpdateSchema>;
export type DebtListQuery = z.infer<typeof debtListQuerySchema>;
export type DebtPaymentCreateInput = z.infer<typeof debtPaymentCreateSchema>;
