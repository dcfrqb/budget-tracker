import { cache } from "react";
import { db } from "@/lib/db";
import type { BudgetSettings } from "@prisma/client";
import { DEFAULT_CURRENCY } from "@/lib/constants";

export const getUserContext = cache(async (userId: string) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { budgetSettings: true },
  });

  const mode = user?.budgetSettings?.activeMode ?? "NORMAL";
  const currency = user?.budgetSettings?.primaryCurrencyCode ?? DEFAULT_CURRENCY;

  return {
    userId,
    primaryCurrencyCode: currency,
    activeMode: mode,
    onboardedAt: user?.onboardedAt ?? null,
  };
});

export async function getPrimaryCurrency(userId: string): Promise<string> {
  const { primaryCurrencyCode } = await getUserContext(userId);
  return primaryCurrencyCode;
}

export const getBudgetSettings = cache(
  async (userId: string): Promise<BudgetSettings | null> => {
    return db.budgetSettings.findUnique({ where: { userId } });
  },
);
