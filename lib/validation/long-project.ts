import { z } from "zod";
import { zCuid, zCurrencyCode, zIsoDate, zMoney } from "./shared";

export const longProjectCreateSchema = z.object({
  name: z.string().min(1).max(200),
  note: z.string().max(500).nullish(),
  budget: zMoney,
  currencyCode: zCurrencyCode,
  categoryId: zCuid.nullish(),
  startDate: zIsoDate,
  endDate: zIsoDate.nullish(),
});

export const longProjectUpdateSchema = longProjectCreateSchema.partial();

export type LongProjectCreateInput = z.infer<typeof longProjectCreateSchema>;
export type LongProjectUpdateInput = z.infer<typeof longProjectUpdateSchema>;
