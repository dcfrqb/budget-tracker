import { z } from "zod";
import { FreelanceOrderStatus } from "@prisma/client";
import { zCuid, zCurrencyCode, zMoney, zIsoDate } from "./shared";

export const freelanceOrderCreateSchema = z.object({
  workSourceId: zCuid,
  client: z.string().max(200).nullish(),
  amount: zMoney,
  currencyCode: zCurrencyCode,
  hours: zMoney.nullish(),
  hourlyRate: zMoney.nullish(),
  tipsAmount: zMoney.nullish(),
  status: z.nativeEnum(FreelanceOrderStatus).default(FreelanceOrderStatus.ACTIVE),
  performedAt: zIsoDate.nullish(),
  paidAt: zIsoDate.nullish(),
  note: z.string().max(500).nullish(),
});

export const freelanceOrderUpdateSchema = freelanceOrderCreateSchema.partial();

export type FreelanceOrderCreateInput = z.infer<typeof freelanceOrderCreateSchema>;
export type FreelanceOrderUpdateInput = z.infer<typeof freelanceOrderUpdateSchema>;
