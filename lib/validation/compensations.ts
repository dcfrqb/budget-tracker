import { z } from "zod";

export const createCompensationSchema = z.object({
  txnIds: z.array(z.string().min(1)).min(2, "at least 2 transactions required"),
});

export const breakCompensationSchema = z.object({
  groupId: z.string().min(1),
});

export type CreateCompensationInput = z.infer<typeof createCompensationSchema>;
export type BreakCompensationInput = z.infer<typeof breakCompensationSchema>;
