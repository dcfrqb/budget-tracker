import { cache } from "react";
import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_CURRENCY, DEFAULT_TZ } from "@/lib/constants";
import { getPeriodFlow } from "@/lib/data/_shared/period-aggregates";
import { getAvailableNow } from "@/lib/data/_shared/period-aggregates";
import { getCompareSparklines } from "@/lib/data/analytics";
import { getLatestRatesMap, convertToBase } from "@/lib/data/wallet";
import { getCompensationProjection } from "@/lib/data/_shared/compensation-projection";
import type { DateRange } from "@/lib/data/analytics";

export type BurnRate = {
  perDay30dBase: string;
  perDay90dBase: string;
  availableNowBase: string;
  daysToZero: number | null;
  alreadyNegative: boolean;
};

export type ShrinkableCategory = {
  categoryId: string;
  categoryName: string;
  icon: string | null;
  currentMonthBase: string;
  avg6mBase: string;
  overspendBase: string;
  overspendPct: number;
};

// ─────────────────────────────────────────────────────────────
// getBurnRate
// ─────────────────────────────────────────────────────────────

export const getBurnRate = cache(async (
  userId: string,
  baseCcy: string,
  tz: string = DEFAULT_TZ,
  now: Date = new Date(),
): Promise<BurnRate> => {
  const range30 = { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
  const range90 = { from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), to: now };

  const [flow30, flow90, availableNow] = await Promise.all([
    getPeriodFlow(userId, range30, baseCcy),
    getPeriodFlow(userId, range90, baseCcy),
    getAvailableNow(userId, DEFAULT_CURRENCY, now),
  ]);

  const outflow30 = flow30.outflowBase;
  const outflow90 = flow90.outflowBase;

  const perDay30 = outflow30.isZero() ? new Prisma.Decimal(0) : outflow30.div(30);
  const perDay90 = outflow90.isZero() ? new Prisma.Decimal(0) : outflow90.div(90);

  const freeBase = availableNow.freeBase;
  const alreadyNegative = freeBase.lte(0);

  let daysToZero: number | null = null;
  if (!alreadyNegative && perDay30.gt(0)) {
    daysToZero = Math.floor(freeBase.div(perDay30).toNumber());
  }

  return {
    perDay30dBase: perDay30.toString(),
    perDay90dBase: perDay90.toString(),
    availableNowBase: freeBase.toString(),
    daysToZero,
    alreadyNegative,
  };
});

// ─────────────────────────────────────────────────────────────
// getShrinkableCategories
// Top-3 categories overspending vs their 6-month norm.
// ─────────────────────────────────────────────────────────────

const EPSILON = 0.01;

export const getShrinkableCategories = cache(async (
  userId: string,
  baseCcy: string,
  tz: string = DEFAULT_TZ,
): Promise<ShrinkableCategory[]> => {
  const [sparklines, categories] = await Promise.all([
    getCompareSparklines(userId, baseCcy, tz, 6),
    db.category.findMany({
      where: { userId, kind: "EXPENSE" },
      select: { id: true, name: true, icon: true },
    }),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, c]));

  const candidates: ShrinkableCategory[] = [];

  for (const [categoryId, series] of sparklines.entries()) {
    if (series.length < 6) continue;

    const current = series[5];
    const first5 = series.slice(0, 5);
    const avg = first5.reduce((s, v) => s + v, 0) / 5;

    if (avg <= EPSILON) continue;

    const overspend = current - avg;
    if (overspend <= 0) continue;

    const overspendPct = (overspend / avg) * 100;
    const cat = catMap.get(categoryId);

    candidates.push({
      categoryId,
      categoryName: cat?.name ?? "—",
      icon: cat?.icon ?? null,
      currentMonthBase: String(current),
      avg6mBase: String(avg),
      overspendBase: String(overspend),
      overspendPct: Math.round(overspendPct * 10) / 10,
    });
  }

  candidates.sort((a, b) => Number(b.overspendBase) - Number(a.overspendBase));

  return candidates.slice(0, 3);
});

// ─────────────────────────────────────────────────────────────
// getObligatoryDiscretionarySplit
// Splits EXPENSE outflow in a date range into essential (obligatory)
// and non-essential (discretionary) buckets using category.essential flag.
// Reuses the same aggregation invariants as getCategoryPie:
//   - transferId:null, EXPENSE kind, DONE|PARTIAL status
//   - compensationProjection (whereExcludeNonMain + rewriteAmount)
//   - confirmedAmt for PARTIAL, convertToBase for multi-currency
//   - uncategorized → treated as discretionary (conservative assumption)
// ─────────────────────────────────────────────────────────────

export type ObligatoryDiscretionarySplit = {
  obligatoryBase: string;
  discretionaryBase: string;
  totalBase: string;
  discretionaryPct: number;
};

export const getObligatoryDiscretionarySplit = cache(async (
  userId: string,
  range: DateRange,
  baseCcy: string,
  _tz: string = DEFAULT_TZ,
): Promise<ObligatoryDiscretionarySplit> => {
  const [proj, rates, categories] = await Promise.all([
    getCompensationProjection(userId),
    getLatestRatesMap(),
    db.category.findMany({
      where: { userId, kind: "EXPENSE" },
      select: { id: true, essential: true },
    }),
  ]);

  const essentialSet = new Set(
    categories.filter((c) => c.essential).map((c) => c.id),
  );

  const rows = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      occurredAt: { gte: range.from, lte: range.to },
      kind: TransactionKind.EXPENSE,
      transferId: null,
      status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      ...proj.whereExcludeNonMain,
    },
    select: {
      id: true,
      categoryId: true,
      status: true,
      amount: true,
      currencyCode: true,
      facts: { select: { amount: true } },
    },
  });

  let obligatory = new Prisma.Decimal(0);
  let discretionary = new Prisma.Decimal(0);

  for (const tx of rows) {
    const override = proj.rewriteAmount(tx.id);
    let inBase: Prisma.Decimal | undefined;

    let catId = tx.categoryId;
    if (override) {
      inBase = override.netBase;
      const groupInfo = proj.groupByMainTxnId.get(tx.id);
      if (groupInfo?.categoryIdForAggregation) catId = groupInfo.categoryIdForAggregation;
    } else {
      const actual =
        tx.status === TransactionStatus.DONE
          ? new Prisma.Decimal(tx.amount)
          : tx.facts.reduce((acc, f) => acc.plus(f.amount), new Prisma.Decimal(0));
      const converted = convertToBase(actual, tx.currencyCode, baseCcy, rates);
      if (!converted) continue;
      inBase = converted;
    }

    if (catId && essentialSet.has(catId)) {
      obligatory = obligatory.plus(inBase);
    } else {
      discretionary = discretionary.plus(inBase);
    }
  }

  const total = obligatory.plus(discretionary);
  const discretionaryPct = total.isZero()
    ? 0
    : Math.round(discretionary.div(total).times(100).toNumber());

  return {
    obligatoryBase: obligatory.toString(),
    discretionaryBase: discretionary.toString(),
    totalBase: total.toString(),
    discretionaryPct,
  };
});
