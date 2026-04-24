import { z } from "zod";
import { zCuid, zCurrencyCode, zIsoDate, zMoney } from "./shared";

export const loanCreateSchema = z.object({
  name: z.string().min(1).max(200),
  principal: zMoney,
  annualRatePct: z.number().min(0).max(200),
  termMonths: z.number().int().min(1).max(600),
  startDate: zIsoDate,
  currencyCode: zCurrencyCode,
  accountId: zCuid.nullish(),
  note: z.string().max(500).nullish(),
});

export const loanUpdateSchema = loanCreateSchema.partial();

export const loanPaymentCreateSchema = z.object({
  totalAmount: zMoney,
  paidAt: zIsoDate.optional(),
  principalPart: zMoney.nullish(),
  interestPart: zMoney.nullish(),
  accountId: zCuid.nullish(),
  note: z.string().max(500).nullish(),
});

export type LoanCreateInput = z.infer<typeof loanCreateSchema>;
export type LoanUpdateInput = z.infer<typeof loanUpdateSchema>;
export type LoanPaymentCreateInput = z.infer<typeof loanPaymentCreateSchema>;
