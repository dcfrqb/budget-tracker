import { z } from "zod";
import { FundKind, Scope } from "@prisma/client";
import { zCuid, zCurrencyCode, zIsoDate, zMoney } from "./shared";

export const fundCreateSchema = z.object({
  kind: z.nativeEnum(FundKind),
  name: z.string().min(1).max(200),
  note: z.string().max(500).nullish(),
  goalAmount: zMoney,
  currentAmount: zMoney.optional(),
  monthlyContribution: zMoney.nullish(),
  targetDate: zIsoDate.nullish(),
  currencyCode: zCurrencyCode,
  scope: z.nativeEnum(Scope).optional(),
  familyId: zCuid.nullish(),
});

export const fundUpdateSchema = fundCreateSchema.partial();

export type FundCreateInput = z.infer<typeof fundCreateSchema>;
export type FundUpdateInput = z.infer<typeof fundUpdateSchema>;
