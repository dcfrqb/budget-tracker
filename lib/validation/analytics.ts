import { z } from "zod";

const ROLLING_PERIODS = ["1m", "3m", "6m", "12m", "ytd", "custom"] as const;
const CALENDAR_PERIOD_RE = /^(m\d{4}-\d{2}|q\d{4}-[1-4]|y\d{4})$/;

export const analyticsQuerySchema = z.object({
  period: z
    .string()
    .refine(
      (v) => ROLLING_PERIODS.includes(v as (typeof ROLLING_PERIODS)[number]) || CALENDAR_PERIOD_RE.test(v),
      { message: "Invalid period code" },
    )
    .default("1m"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  baseCcy: z.string().length(3).optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
