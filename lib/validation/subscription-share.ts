import { z } from "zod";
import { zCuid, zMoney } from "./shared";

export const subscriptionShareCreateSchema = z.object({
  person: z.string().min(1).max(120),
  familyMemberId: zCuid.nullish(),
  amount: zMoney.nullish(),
});

export const subscriptionShareUpdateSchema = subscriptionShareCreateSchema.partial();

export type SubscriptionShareCreateInput = z.infer<typeof subscriptionShareCreateSchema>;
export type SubscriptionShareUpdateInput = z.infer<typeof subscriptionShareUpdateSchema>;
