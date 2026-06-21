import { z } from "zod";
import { BudgetMode } from "@prisma/client";
import { CURATED_DEFAULT_PERIODS } from "@/lib/data/_period";

export const budgetSettingsUpdateSchema = z.object({
  activeMode: z.nativeEnum(BudgetMode).optional(),
  primaryCurrencyCode: z.string().length(3).optional(),
  defaultPeriod: z.enum(CURATED_DEFAULT_PERIODS).optional(),
});

export type BudgetSettingsUpdateInput = z.infer<typeof budgetSettingsUpdateSchema>;
