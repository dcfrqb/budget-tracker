import { cache } from "react";
import { Prisma } from "@prisma/client";
import type { LongProject, Transaction } from "@prisma/client";
import { db } from "@/lib/db";

export const getLongProjects = cache(async (userId: string) => {
  return db.longProject.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { startDate: "asc" },
  });
});

export const getLongProjectById = cache(async (userId: string, id: string) => {
  return db.longProject.findFirst({
    where: { id, userId },
    include: {
      category: true,
      _count: { select: { transactions: true } },
    },
  });
});

export type ProjectProgress = {
  spentTotal: Prisma.Decimal;
  remainingBudget: Prisma.Decimal;
  pctUsed: number;
};

export function computeProjectProgress(
  project: LongProject,
  transactions: Pick<Transaction, "amount" | "status">[],
): ProjectProgress {
  const zero = new Prisma.Decimal(0);
  const spentTotal = transactions
    .filter((t) => t.status === "DONE")
    .reduce((acc, t) => acc.plus(t.amount), zero);

  const budget = new Prisma.Decimal(project.budget);
  const remainingBudget = budget.minus(spentTotal);
  const pctUsed = budget.isZero()
    ? 0
    : spentTotal.div(budget).times(100).toNumber();

  return { spentTotal, remainingBudget, pctUsed };
}
