import { z } from "zod";
import { PlannedEventKind } from "@prisma/client";
import { zCuid, zCurrencyCode, zIsoDate, zMoney } from "./shared";

export const plannedEventCreateSchema = z.object({
  kind: z.nativeEnum(PlannedEventKind),
  name: z.string().min(1).max(200),
  note: z.string().max(500).nullish(),
  eventDate: zIsoDate,
  repeatsYearly: z.boolean().optional(),
  fundId: zCuid.nullish(),
  expectedAmount: zMoney.nullish(),
  currencyCode: zCurrencyCode.nullish(),
});

export const plannedEventUpdateSchema = plannedEventCreateSchema.partial();

export type PlannedEventCreateInput = z.infer<typeof plannedEventCreateSchema>;
export type PlannedEventUpdateInput = z.infer<typeof plannedEventUpdateSchema>;
