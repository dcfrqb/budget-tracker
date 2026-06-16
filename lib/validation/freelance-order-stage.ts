import { z } from "zod";
import { zCuid, zMoney, zIsoDate } from "./shared";

export const stageCreateSchema = z.object({
  freelanceOrderId: zCuid,
  label: z.string().min(1).max(120),
  expectedAmount: zMoney,
  dueDate: zIsoDate.nullish(),
  sortOrder: z.number().int().optional(),
});

export const stageUpdateSchema = stageCreateSchema.partial();

export const stageMarkPaidSchema = z.object({
  stageId: zCuid,
  accountId: zCuid,
  paidAmount: zMoney.optional(),
  paidAt: zIsoDate.nullish(),
  categoryId: zCuid.nullish(),
  note: z.string().max(500).nullish(),
});

export const stageAttachTxnSchema = z.object({
  stageId: zCuid,
  txnId: zCuid,
});

export const stageUnmarkSchema = z.object({
  stageId: zCuid,
});

export const stageDeleteSchema = z.object({
  stageId: zCuid,
});

export type StageCreateInput = z.infer<typeof stageCreateSchema>;
export type StageUpdateInput = z.infer<typeof stageUpdateSchema>;
export type StageMarkPaidInput = z.infer<typeof stageMarkPaidSchema>;
export type StageAttachTxnInput = z.infer<typeof stageAttachTxnSchema>;
export type StageUnmarkInput = z.infer<typeof stageUnmarkSchema>;
export type StageDeleteInput = z.infer<typeof stageDeleteSchema>;
