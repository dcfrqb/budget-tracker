import { z } from "zod";
import { WorkKind } from "@prisma/client";
import { zCurrencyCode, zMoney } from "./shared";

export const workSourceCreateSchema = z.object({
  // "name" в базе — плановый field называется label в API
  name: z.string().min(1).max(200),
  kind: z.nativeEnum(WorkKind),
  baseAmount: zMoney.nullish(),
  currencyCode: zCurrencyCode,
  payDay: z.number().int().min(1).max(31).nullish(),
  hourlyRate: zMoney.nullish(),
  taxRatePct: z.number().min(0).max(100).nullish(),
  hoursPerMonth: z.number().int().min(1).max(744).nullish(),
  isActive: z.boolean().optional(),
  notes: z.string().max(500).nullish(),
});

export const workSourceUpdateSchema = workSourceCreateSchema.partial();

export type WorkSourceCreateInput = z.infer<typeof workSourceCreateSchema>;
export type WorkSourceUpdateInput = z.infer<typeof workSourceUpdateSchema>;
