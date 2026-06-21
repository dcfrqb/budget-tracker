import { Prisma, BudgetMode } from "@prisma/client";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format/money";
import type { HomeDashboard } from "@/lib/data/dashboard";
import type { ShrinkableCategory, ObligatoryDiscretionarySplit, EconomyExitScenario } from "@/lib/data/analytics-prescriptive";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type RawSignal = {
  key: string;
  kind: "acc" | "warn" | "info";
  priority: number;
  titleKey: string;
  bodyKey: string;
  vars?: Record<string, string | number>;
};

export type SignalEngineInput = {
  dashboard: HomeDashboard;
  shrinkable: ShrinkableCategory[];
  discretionary: ObligatoryDiscretionarySplit;
  economyExit: EconomyExitScenario;
  baseCcy: string;
};

// ─────────────────────────────────────────────────────────────
// getDismissedSignals
// ─────────────────────────────────────────────────────────────

export async function getDismissedSignals(userId: string): Promise<Set<string>> {
  const now = new Date();
  const rows = await db.dismissedSignal.findMany({
    where: {
      userId,
      OR: [
        { dismissUntil: null },
        { dismissUntil: { gt: now } },
      ],
    },
    select: { signalKey: true },
  });
  return new Set(rows.map((r) => r.signalKey));
}

// ─────────────────────────────────────────────────────────────
// computeSignals — pure, no I/O
// ─────────────────────────────────────────────────────────────

export function computeSignals(input: SignalEngineInput): RawSignal[] {
  const { dashboard, shrinkable, discretionary, economyExit, baseCcy } = input;
  const now = new Date();

  const freeBase = new Prisma.Decimal(dashboard.freeBase);
  const reservedBase = new Prisma.Decimal(dashboard.reservedBase);
  const inflowFact = new Prisma.Decimal(dashboard.planFactMonth.inflowFactBase);
  const outflowFact = new Prisma.Decimal(dashboard.planFactMonth.outflowFactBase);
  const inflowPlan = new Prisma.Decimal(dashboard.planFactMonth.inflowPlanBase);
  const outflowPlan = new Prisma.Decimal(dashboard.planFactMonth.outflowPlanBase);
  const { safeUntilDays, status, budgetMode, balances, upcomingObligations30d, topCategoriesDelta } = dashboard;
  const { hasInflowPlan, hasOutflowPlan } = dashboard.planFactMonth;

  const signals: RawSignal[] = [];

  // ── CRISIS (prio 100+) ────────────────────────────────────

  // free_negative: freeBase <= 0
  if (freeBase.lte(0)) {
    signals.push({
      key: "free_negative",
      kind: "warn",
      priority: 130,
      titleKey: "signals.item.free_negative.title",
      bodyKey: "signals.item.free_negative.body",
    });
  }

  // safe_until_critical: safeUntilDays != null && < 7
  if (safeUntilDays !== null && safeUntilDays < 7) {
    signals.push({
      key: "safe_until_critical",
      kind: "warn",
      priority: 120,
      titleKey: "signals.item.safe_until_critical.title",
      bodyKey: "signals.item.safe_until_critical.body",
      vars: { n: safeUntilDays },
    });
  }

  // month_deficit: inflowFact - outflowFact < 0 && |net| >= 0.05 * outflowFact
  if (!outflowFact.isZero()) {
    const net = inflowFact.minus(outflowFact);
    if (net.lt(0) && net.abs().gte(outflowFact.times("0.05"))) {
      signals.push({
        key: "month_deficit",
        kind: "warn",
        priority: 110,
        titleKey: "signals.item.month_deficit.title",
        bodyKey: "signals.item.month_deficit.body",
        vars: { amt: formatMoney(net.abs(), baseCcy) },
      });
    }
  }

  // ── WARN (prio 50–99) ─────────────────────────────────────

  // safe_until_low: safeUntilDays in [7, 21)
  if (safeUntilDays !== null && safeUntilDays >= 7 && safeUntilDays < 21) {
    signals.push({
      key: "safe_until_low",
      kind: "warn",
      priority: 90,
      titleKey: "signals.item.safe_until_low.title",
      bodyKey: "signals.item.safe_until_low.body",
      vars: { n: safeUntilDays },
    });
  }

  // obligation_due_soon: nearest obligation with dueAt <= 4 days from now
  const soonObligations = upcomingObligations30d.filter((ob) => {
    const diffMs = new Date(ob.dueAt).getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    return diffDays <= 4 && diffDays >= 0;
  });
  if (soonObligations.length > 0) {
    const nearest = [...soonObligations].sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
    )[0];
    const diffMs = new Date(nearest.dueAt).getTime() - now.getTime();
    const diffDays = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    signals.push({
      key: "obligation_due_soon",
      kind: "warn",
      priority: 88,
      titleKey: "signals.item.obligation_due_soon.title",
      bodyKey: "signals.item.obligation_due_soon.body",
      vars: {
        label: nearest.label,
        n: diffDays,
        amt: formatMoney(new Prisma.Decimal(nearest.amountBase), baseCcy),
      },
    });
  }

  // obligation_load_high: freeBase > 0 && sum(obligations30d.amountBase) > 0.5 * freeBase
  if (freeBase.gt(0) && upcomingObligations30d.length > 0) {
    const totalObligations = upcomingObligations30d.reduce(
      (acc, ob) => acc.plus(new Prisma.Decimal(ob.amountBase)),
      new Prisma.Decimal(0),
    );
    if (totalObligations.gt(freeBase.times("0.5"))) {
      const pct = Math.round(totalObligations.div(freeBase).times(100).toNumber());
      signals.push({
        key: "obligation_load_high",
        kind: "warn",
        priority: 80,
        titleKey: "signals.item.obligation_load_high.title",
        bodyKey: "signals.item.obligation_load_high.body",
        vars: {
          pct,
          amt: formatMoney(totalObligations, baseCcy),
        },
      });
    }
  }

  // category_overspend:{catId}: deltaPct >= 40 && currentMonthBase > 0, max 2
  const overspendCats = topCategoriesDelta
    .filter((c) => c.deltaPct !== null && c.deltaPct >= 40 && new Prisma.Decimal(c.currentMonthBase).gt(0))
    .sort((a, b) => (b.deltaPct ?? 0) - (a.deltaPct ?? 0))
    .slice(0, 2);

  for (const cat of overspendCats) {
    signals.push({
      key: `category_overspend:${cat.categoryId}`,
      kind: "warn",
      priority: 78,
      titleKey: "signals.item.category_overspend.title",
      bodyKey: "signals.item.category_overspend.body",
      vars: {
        cat: cat.categoryName,
        pct: Math.round(cat.deltaPct ?? 0),
        amt: formatMoney(new Prisma.Decimal(cat.currentMonthBase), baseCcy),
      },
    });
  }

  // expense_over_plan: hasOutflowPlan && outflowFact > 1.1 * outflowPlan
  if (hasOutflowPlan && !outflowPlan.isZero() && outflowFact.gt(outflowPlan.times("1.1"))) {
    const pct = Math.round(outflowFact.div(outflowPlan).times(100).toNumber());
    signals.push({
      key: "expense_over_plan",
      kind: "warn",
      priority: 76,
      titleKey: "signals.item.expense_over_plan.title",
      bodyKey: "signals.item.expense_over_plan.body",
      vars: {
        pct,
        plan: formatMoney(outflowPlan, baseCcy),
        fact: formatMoney(outflowFact, baseCcy),
      },
    });
  }

  // income_under_plan: hasInflowPlan && inflowFact < 0.6 * inflowPlan
  if (hasInflowPlan && !inflowPlan.isZero() && inflowFact.lt(inflowPlan.times("0.6"))) {
    const pct = Math.round(inflowFact.div(inflowPlan).times(100).toNumber());
    signals.push({
      key: "income_under_plan",
      kind: "warn",
      priority: 74,
      titleKey: "signals.item.income_under_plan.title",
      bodyKey: "signals.item.income_under_plan.body",
      vars: {
        pct,
        plan: formatMoney(inflowPlan, baseCcy),
        fact: formatMoney(inflowFact, baseCcy),
      },
    });
  }

  // shrinkable:{catId}: shrinkable[0] with overspendPct >= 30
  if (shrinkable.length > 0 && shrinkable[0].overspendPct >= 30) {
    const top = shrinkable[0];
    signals.push({
      key: `shrinkable:${top.categoryId}`,
      kind: "warn",
      priority: 70,
      titleKey: "signals.item.shrinkable.title",
      bodyKey: "signals.item.shrinkable.body",
      vars: {
        cat: top.categoryName,
        pct: Math.round(top.overspendPct),
        amt: formatMoney(new Prisma.Decimal(top.overspendBase), baseCcy),
      },
    });
  }

  // discretionary_high: discretionaryPct > 60
  if (discretionary.discretionaryPct > 60) {
    signals.push({
      key: "discretionary_high",
      kind: "warn",
      priority: 66,
      titleKey: "signals.item.discretionary_high.title",
      bodyKey: "signals.item.discretionary_high.body",
      vars: { pct: discretionary.discretionaryPct },
    });
  }

  // economy_exit_slow: monthsToRecover >= 4
  if (economyExit.state === "recovering" && economyExit.monthsToRecover !== null && economyExit.monthsToRecover >= 4) {
    signals.push({
      key: "economy_exit_slow",
      kind: "warn",
      priority: 62,
      titleKey: "signals.item.economy_exit_slow.title",
      bodyKey: "signals.item.economy_exit_slow.body",
      vars: { n: economyExit.monthsToRecover },
    });
  }

  // ── INFO (prio 10–49) ─────────────────────────────────────

  // mode_free_risky: budgetMode==FREE && status!="stable"
  if (budgetMode === BudgetMode.FREE && status !== "stable") {
    signals.push({
      key: "mode_free_risky",
      kind: "info",
      priority: 40,
      titleKey: "signals.item.mode_free_risky.title",
      bodyKey: "signals.item.mode_free_risky.body",
    });
  }

  // no_outflow_plan: !hasOutflowPlan && outflowFact > 0
  if (!hasOutflowPlan && outflowFact.gt(0)) {
    signals.push({
      key: "no_outflow_plan",
      kind: "info",
      priority: 34,
      titleKey: "signals.item.no_outflow_plan.title",
      bodyKey: "signals.item.no_outflow_plan.body",
      vars: { amt: formatMoney(outflowFact, baseCcy) },
    });
  }

  // no_inflow_plan: !hasInflowPlan
  if (!hasInflowPlan) {
    signals.push({
      key: "no_inflow_plan",
      kind: "info",
      priority: 32,
      titleKey: "signals.item.no_inflow_plan.title",
      bodyKey: "signals.item.no_inflow_plan.body",
    });
  }

  // category_new:{catId}: prevMonthBase==0 && currentMonthBase>0, max 1
  const newCat = topCategoriesDelta.find(
    (c) => new Prisma.Decimal(c.prevMonthBase).isZero() && new Prisma.Decimal(c.currentMonthBase).gt(0),
  );
  if (newCat) {
    signals.push({
      key: `category_new:${newCat.categoryId}`,
      kind: "info",
      priority: 30,
      titleKey: "signals.item.category_new.title",
      bodyKey: "signals.item.category_new.body",
      vars: {
        cat: newCat.categoryName,
        amt: formatMoney(new Prisma.Decimal(newCat.currentMonthBase), baseCcy),
      },
    });
  }

  // multi_currency: balances.length >= 3
  if (balances.length >= 3) {
    signals.push({
      key: "multi_currency",
      kind: "info",
      priority: 20,
      titleKey: "signals.item.multi_currency.title",
      bodyKey: "signals.item.multi_currency.body",
      vars: { n: balances.length },
    });
  }

  // burn_rate: avgDailySpend > 0 (avgDailySpend is not directly on dashboard, derive from safe/liquid)
  // The dashboard doesn't expose avgDailySpend directly; we can approximate from safeUntilDays + freeBase
  // Actually dashboard doesn't carry avgDailySpend. Use a simple heuristic: if safeUntilDays is available
  // and freeBase > 0, compute avgDaily = freeBase / safeUntilDays
  if (safeUntilDays !== null && safeUntilDays > 0 && freeBase.gt(0)) {
    const avgDaily = freeBase.div(safeUntilDays);
    if (avgDaily.gt(0)) {
      signals.push({
        key: "burn_rate",
        kind: "info",
        priority: 16,
        titleKey: "signals.item.burn_rate.title",
        bodyKey: "signals.item.burn_rate.body",
        vars: { amt: formatMoney(avgDaily, baseCcy) },
      });
    }
  }

  // ── POSITIVE (prio 1–9) ───────────────────────────────────

  // safe_until_good: safeUntilDays==null || > 90
  if (safeUntilDays === null || safeUntilDays > 90) {
    signals.push({
      key: "safe_until_good",
      kind: "acc",
      priority: 8,
      titleKey: "signals.item.safe_until_good.title",
      bodyKey: "signals.item.safe_until_good.body",
    });
  }

  // month_surplus: inflowFact - outflowFact > 0.05 * outflowFact
  if (!outflowFact.isZero()) {
    const net = inflowFact.minus(outflowFact);
    if (net.gt(outflowFact.times("0.05"))) {
      signals.push({
        key: "month_surplus",
        kind: "acc",
        priority: 6,
        titleKey: "signals.item.month_surplus.title",
        bodyKey: "signals.item.month_surplus.body",
        vars: { amt: formatMoney(net, baseCcy) },
      });
    }
  }

  // obligations_clear: upcomingObligations30d.length == 0
  if (upcomingObligations30d.length === 0) {
    signals.push({
      key: "obligations_clear",
      kind: "acc",
      priority: 4,
      titleKey: "signals.item.obligations_clear.title",
      bodyKey: "signals.item.obligations_clear.body",
    });
  }

  return signals;
}
