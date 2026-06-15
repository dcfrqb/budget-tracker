import { z } from "zod";

const zCuid = z.string().min(1);

export const createCompensationSchema = z.object({
  txnIds: z.array(zCuid).min(2, "at least 2 transactions required"),
});

export const createMergeSchema = z.object({
  txnIds: z.array(zCuid).min(2, "at least 2 transactions required"),
});

export const breakCompensationSchema = z.object({
  groupId: z.string().min(1),
});

export type CreateCompensationInput = z.infer<typeof createCompensationSchema>;
export type CreateMergeInput = z.infer<typeof createMergeSchema>;
export type BreakCompensationInput = z.infer<typeof breakCompensationSchema>;
