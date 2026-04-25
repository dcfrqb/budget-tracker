import { z } from "zod";
import { AccountKind, SavingsCapitalization } from "@prisma/client";
import { zCuid, zCurrencyCode, zMoney } from "./shared";

// ─────────────────────────────────────────────────────────────
// Base schema (shared fields)
// ─────────────────────────────────────────────────────────────

const baseAccountSchema = z.object({
  institutionId: zCuid.nullish(),
  kind: z.nativeEnum(AccountKind),
  name: z.string().min(1).max(120),
  currencyCode: zCurrencyCode,
  balance: zMoney.optional(),
  sub: z.string().max(200).nullish(),
  location: z.string().max(120).nullish(),
  sortOrder: z.number().int().nonnegative().optional(),
  includeInAnalytics: z.boolean().optional(),

  // SAVINGS fields
  annualRatePct: zMoney.nullish(),
  savingsCapitalization: z.nativeEnum(SavingsCapitalization).nullish(),
  withdrawalLimit: zMoney.nullish(),

  // CREDIT fields
  creditRatePct: zMoney.nullish(),
  creditLimit: zMoney.nullish(),
  gracePeriodDays: z.number().int().min(0).max(365).nullish(),
  statementDay: z.number().int().min(1).max(31).nullish(),
  minPaymentPercent: zMoney.nullish(),
  minPaymentFixed: zMoney.nullish(),
});

// ─────────────────────────────────────────────────────────────
// Create schema with superRefine validation
// ─────────────────────────────────────────────────────────────

export const accountCreateSchema = baseAccountSchema.superRefine((data, ctx) => {
  if (data.kind === AccountKind.CREDIT) {
    if (!data.creditRatePct) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "credit_rate_required",
        path: ["creditRatePct"],
      });
    }
    if (!data.creditLimit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "credit_limit_required",
        path: ["creditLimit"],
      });
    }
  }

  if (data.kind === AccountKind.SAVINGS) {
    if (!data.annualRatePct) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "savings_rate_required",
        path: ["annualRatePct"],
      });
    }
  }

  if (data.kind === AccountKind.CASH) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "cash_goes_through_cash_stash",
      path: ["kind"],
    });
  }
});

export const accountUpdateSchema = baseAccountSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

export const accountReorderSchema = z
  .array(z.object({ id: zCuid, sortOrder: z.number().int().nonnegative() }))
  .min(1);

export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;
export type AccountReorderInput = z.infer<typeof accountReorderSchema>;
