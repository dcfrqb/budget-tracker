import { z } from "zod";
import { SharingType } from "@prisma/client";
import { zCuid, zCurrencyCode, zIsoDate, zMoney } from "./shared";

// Base object without refinements so .partial() can be called on it.
const subscriptionBaseSchema = z.object({
  name: z.string().min(1).max(200),
  icon: z.string().max(100).nullish(),
  iconColor: z.string().max(32).nullish(),
  iconBg: z.string().max(32).nullish(),
  price: zMoney,
  currencyCode: zCurrencyCode,
  billingIntervalMonths: z.number().int().min(1).max(120).default(1),
  nextPaymentDate: zIsoDate,
  sharingType: z.nativeEnum(SharingType).default("PERSONAL"),
  totalUsers: z.number().int().min(2).nullish(),
  familyId: zCuid.nullish(),
  isActive: z.boolean().optional(),
  isVariablePrice: z.boolean().optional(),
  autoMatch: z.boolean().optional(),
  matchKeywords: z.array(z.string().min(1).max(200)).optional(),
  reimbursementExpected: zMoney.nullish(),
  reimbursementCurrency: zCurrencyCode.nullish(),
  reimbursementFrom: z.string().max(200).nullish(),
});

// JSON editor item: includes optional id for update/create diff semantics.
export const subscriptionJsonItemSchema = subscriptionBaseSchema.extend({
  id: zCuid.optional(),
}).superRefine((data, ctx) => {
  if (data.sharingType === "SPLIT" && (data.totalUsers == null || data.totalUsers < 2)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["totalUsers"],
      message: "totalUsers is required and must be ≥ 2 for SPLIT subscriptions",
    });
  }
});

export const subscriptionsBulkReplaceSchema = z.array(subscriptionJsonItemSchema).max(500);

// Create: totalUsers is required (≥ 2) when sharingType is SPLIT.
// Refinement is applied only here; update uses the base schema to allow .partial().
export const subscriptionCreateSchema = subscriptionBaseSchema.superRefine(
  (data, ctx) => {
    if (data.sharingType === "SPLIT" && (data.totalUsers == null || data.totalUsers < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["totalUsers"],
        message: "totalUsers is required and must be \u2265 2 for SPLIT subscriptions",
      });
    }
  },
);

// Update: all fields optional; no cross-field refinement (partial patches are safe).
export const subscriptionUpdateSchema = subscriptionBaseSchema.partial();

export const subscriptionPaySchema = z.object({
  accountId: zCuid.nullish(),
  paidAt: zIsoDate.optional(),
  note: z.string().max(500).nullish(),
  categoryId: zCuid.nullish(),
});

// ─── Reconciliation schemas ─────────────────────────────────

export const markSubscriptionPaidSchema = z.object({
  subscriptionId: zCuid,
  paidAt: zIsoDate.optional(),
  transactionId: zCuid.nullish(),
});

export const confirmSubscriptionMatchSchema = z.object({
  transactionId: zCuid,
  subscriptionId: zCuid,
});

export const unlinkSubscriptionTxnSchema = z.object({
  transactionId: zCuid,
  rollbackNextPaymentDate: z.boolean().optional(),
});

export const subscriptionsBulkImportSchema = z.array(subscriptionCreateSchema).min(1).max(500);

// ─── From-selection schemas ─────────────────────────────────

export const subscriptionFromTransactionsSchema = z.object({
  name: z.string().min(1).max(200),
  transactionIds: z.array(zCuid).min(1).max(200),
  isVariablePrice: z.boolean().optional(),
  currencyCode: zCurrencyCode,
  billingIntervalMonths: z.number().int().min(1).max(120).default(1),
  categoryId: zCuid.nullish(),
  sharingType: z.nativeEnum(SharingType).default("PERSONAL"),
});

export const linkTransactionsToSubscriptionSchema = z.object({
  subscriptionId: zCuid,
  transactionIds: z.array(zCuid).min(1).max(200),
});

export type SubscriptionFromTransactionsInput = z.infer<typeof subscriptionFromTransactionsSchema>;
export type LinkTransactionsToSubscriptionInput = z.infer<typeof linkTransactionsToSubscriptionSchema>;

export type SubscriptionCreateInput = z.infer<typeof subscriptionCreateSchema>;
export type SubscriptionUpdateInput = z.infer<typeof subscriptionUpdateSchema>;
export type SubscriptionPayInput = z.infer<typeof subscriptionPaySchema>;
export type SubscriptionsBulkImportInput = z.infer<typeof subscriptionsBulkImportSchema>;
export type SubscriptionJsonItem = z.infer<typeof subscriptionJsonItemSchema>;
export type SubscriptionsBulkReplaceInput = z.infer<typeof subscriptionsBulkReplaceSchema>;
export type MarkSubscriptionPaidInput = z.infer<typeof markSubscriptionPaidSchema>;
export type ConfirmSubscriptionMatchInput = z.infer<typeof confirmSubscriptionMatchSchema>;
export type UnlinkSubscriptionTxnInput = z.infer<typeof unlinkSubscriptionTxnSchema>;

// ─── Reimbursement confirm schema ─────────────────────────────

export const confirmReimbursementSchema = z.object({
  incomeTransactionId: zCuid,
  spendTransactionId: zCuid,
});

export type ConfirmReimbursementInput = z.infer<typeof confirmReimbursementSchema>;

// ─── Merge / dismissal schemas ─────────────────────────────────

export const mergeSubscriptionsSchema = z.object({
  keepId: zCuid,
  mergeId: zCuid,
});

export const dismissDuplicatePairSchema = z.object({
  idA: zCuid,
  idB: zCuid,
});

export type MergeSubscriptionsInput = z.infer<typeof mergeSubscriptionsSchema>;
export type DismissDuplicatePairInput = z.infer<typeof dismissDuplicatePairSchema>;
