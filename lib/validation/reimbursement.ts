import { z } from "zod";
import { zCuid, zIsoDate, zMoney } from "./shared";

export const reimbCreateSchema = z.object({
  amount: zMoney,
  receivedAt: zIsoDate,
  accountId: zCuid.nullish(),
  note: z.string().max(500).nullish(),
});

export const reimbUpdateSchema = reimbCreateSchema.partial();

export type ReimbursementCreateInput = z.infer<typeof reimbCreateSchema>;
export type ReimbursementUpdateInput = z.infer<typeof reimbUpdateSchema>;
