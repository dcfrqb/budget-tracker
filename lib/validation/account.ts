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

  // Card linking — last 4 digits for CSV import matching
  cardLast4: z.array(z.string().regex(/^\d{4}$/)).max(20).default([]),

  // Bank requisites (all optional, free text)
  // Empty string → null so Prisma clears the column on update (undefined = "don't change").
  accountNumber: z.string().trim().max(40).nullish().transform((v) => (v && v.length > 0 ? v : null)),
  bic: z.string().trim().max(20).nullish().transform((v) => (v && v.length > 0 ? v : null)),
  bankName: z.string().trim().max(120).nullish().transform((v) => (v && v.length > 0 ? v : null)),
});

// ─────────────────────────────────────────────────────────────
// Create schema with superRefine validation
// (balance is required on create — not optional like in base)
// ─────────────────────────────────────────────────────────────

// balance on create: accept any string so superRefine can emit the right error code
// before zMoney's regex fires on empty input.
const baseAccountCreateSchema = baseAccountSchema.extend({
  balance: z.string(),
});

export const accountCreateSchema = baseAccountCreateSchema.superRefine((data, ctx) => {
  const balStr = typeof data.balance === "string" ? data.balance.trim() : "";
  if (!balStr) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "balance_required",
      path: ["balance"],
    });
  } else if (!/^-?\d+(\.\d{1,8})?$/.test(balStr)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "invalid money value",
      path: ["balance"],
    });
  }

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

export const accountUpdateSchema = baseAccountSchema
  .partial()
  .extend({
    isArchived: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // If kind is being explicitly changed to CREDIT, creditLimit must be provided.
    if (data.kind === AccountKind.CREDIT && !data.creditLimit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "credit_limit_required",
        path: ["creditLimit"],
      });
    }
  });

export const accountReorderSchema = z
  .array(z.object({ id: zCuid, sortOrder: z.number().int().nonnegative() }))
  .min(1);

export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;
export type AccountReorderInput = z.infer<typeof accountReorderSchema>;
