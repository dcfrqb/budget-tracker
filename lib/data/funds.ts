import { cache } from "react";
import { Prisma } from "@prisma/client";
import type { Fund } from "@prisma/client";
import { db } from "@/lib/db";

export type FundWithProgress = Fund & {
  progressPct: number;
  remainingAmount: Prisma.Decimal;
};

export const getFundsWithProgress = cache(async (userId: string): Promise<FundWithProgress[]> => {
  const funds = await db.fund.findMany({
    where: { userId },
    include: { currency: true, plannedEvents: true },
    orderBy: { createdAt: "asc" },
  });

  return funds.map((fund) => {
    const current = new Prisma.Decimal(fund.currentAmount);
    const goal = new Prisma.Decimal(fund.goalAmount);
    const progressPct = goal.isZero() ? 0 : current.div(goal).times(100).toNumber();
    const remainingAmount = goal.minus(current);
    return { ...fund, progressPct, remainingAmount };
  });
});

export const getFundById = cache(async (userId: string, id: string) => {
  return db.fund.findFirst({
    where: { id, userId },
    include: { currency: true },
  });
});
