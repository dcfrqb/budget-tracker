import { z } from "zod";
import { zCurrencyCode, zIsoDate } from "./shared";

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
