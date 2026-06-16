import { z } from "zod";
import { FreelanceOrderStatus } from "@prisma/client";
import { zCuid, zCurrencyCode, zMoney, zIsoDate } from "./shared";

export const freelanceOrderCreateSchema = z.object({
  workSourceId: zCuid,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
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

export const linkTxnToOrderSchema = z.object({
  orderId: zCuid,
  txnId: zCuid,
});

export const unlinkTxnFromOrderSchema = z.object({
  txnId: zCuid,
});

export type LinkTxnToOrderInput = z.infer<typeof linkTxnToOrderSchema>;
export type UnlinkTxnFromOrderInput = z.infer<typeof unlinkTxnFromOrderSchema>;
