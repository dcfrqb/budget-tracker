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
});

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

export const subscriptionsBulkImportSchema = z.array(subscriptionCreateSchema).min(1).max(500);

export type SubscriptionCreateInput = z.infer<typeof subscriptionCreateSchema>;
export type SubscriptionUpdateInput = z.infer<typeof subscriptionUpdateSchema>;
export type SubscriptionPayInput = z.infer<typeof subscriptionPaySchema>;
export type SubscriptionsBulkImportInput = z.infer<typeof subscriptionsBulkImportSchema>;
