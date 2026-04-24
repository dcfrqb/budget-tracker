import { z } from "zod";

export const analyticsQuerySchema = z.object({
  period: z.enum(["1m", "3m", "6m", "12m", "custom"]).default("1m"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  baseCcy: z.string().length(3).optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
