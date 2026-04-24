import { z } from "zod";
import { BudgetMode } from "@prisma/client";

export const budgetSettingsUpdateSchema = z.object({
  activeMode: z.nativeEnum(BudgetMode).optional(),
  primaryCurrencyCode: z.string().length(3).optional(),
});

export type BudgetSettingsUpdateInput = z.infer<typeof budgetSettingsUpdateSchema>;
