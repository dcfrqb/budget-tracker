import { z } from "zod";
import { AccountKind } from "@prisma/client";
import { zCuid, zCurrencyCode, zMoney } from "./shared";

export const accountCreateSchema = z.object({
  institutionId: zCuid.nullish(),
  kind: z.nativeEnum(AccountKind),
  name: z.string().min(1).max(120),
  currencyCode: zCurrencyCode,
  balance: zMoney.optional(),
  sub: z.string().max(200).nullish(),
  location: z.string().max(120).nullish(),
  annualRatePct: zMoney.nullish(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const accountUpdateSchema = accountCreateSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

export const accountReorderSchema = z
  .array(z.object({ id: zCuid, sortOrder: z.number().int().nonnegative() }))
  .min(1);

export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;
export type AccountReorderInput = z.infer<typeof accountReorderSchema>;
