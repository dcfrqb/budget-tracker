import { z } from "zod";
import { zCurrencyCode } from "./shared";

export const hoursCalcQuerySchema = z.object({
  amount: z.coerce.number().positive(),
  currencyCode: zCurrencyCode,
  workSourceId: z.string().optional(),
});

export type HoursCalcQuery = z.infer<typeof hoursCalcQuerySchema>;
