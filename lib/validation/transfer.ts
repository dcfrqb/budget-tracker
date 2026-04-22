import { z } from "zod";
import { zCuid, zIsoDate, zMoney } from "./shared";

export const transferCreateSchema = z.object({
  fromAccountId: zCuid,
  toAccountId: zCuid,
  fromAmount: zMoney,
  toAmount: zMoney,
  rate: zMoney.optional(),
  fee: zMoney.nullish(),
  occurredAt: zIsoDate,
  note: z.string().max(500).nullish(),
});

export const transferUpdateSchema = transferCreateSchema.partial();

export type TransferCreateInput = z.infer<typeof transferCreateSchema>;
export type TransferUpdateInput = z.infer<typeof transferUpdateSchema>;
