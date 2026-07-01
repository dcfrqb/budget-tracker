import { z } from "zod";
import { BusinessEntryType } from "@prisma/client";
import { zCuid, zCurrencyCode, zIsoDate, zMoney } from "./shared";

const baseShape = {
  name: z.string().min(1).max(200),
  note: z.string().max(500).nullish(),
  currencyCode: zCurrencyCode.nullish(),
  startedAt: zIsoDate.nullish(),
  isActive: z.boolean().optional(),
};

const baseObject = z.object(baseShape);

export const businessCreateSchema = baseObject;
export const businessUpdateSchema = baseObject.partial();

export type BusinessCreateInput = z.infer<typeof businessCreateSchema>;
export type BusinessUpdateInput = z.infer<typeof businessUpdateSchema>;

// ─────────────────────────────────────────────────────────────
// BusinessAllocation
// ─────────────────────────────────────────────────────────────

const zPositiveMoney = zMoney.refine((v) => parseFloat(v) > 0, {
  message: "amount must be greater than 0",
});

const allocationShape = {
  businessId: zCuid,
  transactionId: zCuid.nullish(),
  amount: zPositiveMoney,
  currencyCode: zCurrencyCode.nullish(),
  entryType: z.nativeEnum(BusinessEntryType),
  streamKey: z.string().max(60).nullish(),
  tariff: z.string().max(60).nullish(),
  note: z.string().max(500).nullish(),
  occurredAt: zIsoDate.nullish(),
};

export const businessAllocationCreateSchema = z
  .object(allocationShape)
  .refine(
    (v) => v.transactionId != null || (v.occurredAt != null && v.currencyCode != null),
    {
      message: "occurredAt and currencyCode are required for off-app allocations",
      path: ["occurredAt"],
    },
  );

export const businessAllocationUpdateSchema = z.object({
  amount: zPositiveMoney.optional(),
  currencyCode: zCurrencyCode.optional(),
  entryType: z.nativeEnum(BusinessEntryType).optional(),
  streamKey: z.string().max(60).nullish(),
  tariff: z.string().max(60).nullish(),
  note: z.string().max(500).nullish(),
  occurredAt: zIsoDate.optional(),
});

export type BusinessAllocationCreateInput = z.infer<typeof businessAllocationCreateSchema>;
export type BusinessAllocationUpdateInput = z.infer<typeof businessAllocationUpdateSchema>;
