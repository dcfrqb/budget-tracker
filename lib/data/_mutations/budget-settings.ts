import { db } from "@/lib/db";
import type { BudgetSettingsUpdateInput } from "@/lib/validation/budget-settings";

export async function updateBudgetSettings(
  userId: string,
  input: BudgetSettingsUpdateInput,
) {
  return db.budgetSettings.upsert({
    where: { userId },
    create: {
      userId,
      activeMode: input.activeMode ?? "NORMAL",
      primaryCurrencyCode: input.primaryCurrencyCode ?? "RUB",
    },
    update: input,
  });
}
