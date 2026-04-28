import { ExpenseCategories } from "@/components/expenses/categories";
import { ExpensesKpiRow } from "@/components/expenses/kpi-row";
import { ExpensesStatusStrip } from "@/components/expenses/status-strip";
import { LongProjects } from "@/components/expenses/long-projects";
import { Loans } from "@/components/expenses/loans";
import { Subscriptions } from "@/components/expenses/subscriptions";
import { Taxes } from "@/components/expenses/taxes";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { getLoans } from "@/lib/data/loans";
import { getSubscriptionsGrouped } from "@/lib/data/subscriptions";
import { getLongProjects } from "@/lib/data/long-projects";
import { getLatestRatesMap, convertToBase } from "@/lib/data/wallet";
import { db } from "@/lib/db";
import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { formatRubPrefix } from "@/lib/format/money";
import { computeAmortization } from "@/lib/amortization";
import { getT } from "@/lib/i18n/server";
import type { LongProjectView } from "@/components/expenses/long-projects";
import type { ExpenseCategoryView } from "@/components/expenses/categories";
import type { SubSummaryItem, SubsMonthlyTotals } from "@/components/expenses/subscriptions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  section?: string;
  period?: string;
}>;

type SectionId = "all" | "loans" | "subs" | "projects" | "taxes";

function showSection(active: SectionId, id: SectionId): boolean {
  return active === "all" || active === id;
}

// Maps period param to a look-back window in days
function parsePeriodDays(period: string | undefined): number {
  switch (period) {
    case "30d": return 30;
    case "1y":  return 365;
    case "all": return 3650;
    case "90d":
    default:    return 90;
  }
}

const MONTH_KEYS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] as const;

function fmtBase(n: Prisma.Decimal): string {
  return formatRubPrefix(n);
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);

  const activeSection = (sp.section ?? "all") as SectionId;

  const monthShort = MONTH_KEYS.map(k => t(`common.month.short.${k}` as Parameters<typeof t>[0]));

  function fmtMonthYear(d: Date): string {
    return `${monthShort[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  const now = new Date();
  const periodDays = parsePeriodDays(sp.period);
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  const window30End = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [loans, subscriptionsGrouped, longProjectsRaw, rates] = await Promise.all([
    getLoans(userId),
    getSubscriptionsGrouped(userId),
    getLongProjects(userId),
    getLatestRatesMap(),
  ]);

  // ── Loan monthly total ─────────────────────────────────────
  let loanMonthly = new Prisma.Decimal(0);
  for (const loan of loans) {
    const paidCount = loan.payments.length;
    const schedule = computeAmortization({
      principal: new Prisma.Decimal(loan.principal),
      annualRatePct: new Prisma.Decimal(loan.annualRatePct),
      termMonths: loan.termMonths,
      startDate: loan.startDate,
    });
    const nextRow = schedule.find(r => r.n > paidCount && r.date >= now && r.date <= window30End);
    if (nextRow) {
      const inBase = convertToBase(nextRow.payment, loan.currencyCode, DEFAULT_CURRENCY, rates);
      if (inBase) loanMonthly = loanMonthly.plus(inBase);
    }
  }

  // ── Subs monthly total ──────────────────────────────────────
  const subsMonthly = subscriptionsGrouped.totals.monthlyBase;

  // ── Long projects ───────────────────────────────────────────
  const projectTxnsMap = new Map<string, Prisma.Decimal>();
  if (longProjectsRaw.length > 0) {
    const txns = await db.transaction.findMany({
      where: {
        userId,
        longProjectId: { in: longProjectsRaw.map(p => p.id) },
        deletedAt: null,
        status: TransactionStatus.DONE,
        kind: TransactionKind.EXPENSE,
        // Apply period filter to project transaction lookback
        occurredAt: { gte: periodStart },
      },
      select: { longProjectId: true, amount: true },
    });
    for (const txn of txns) {
      if (!txn.longProjectId) continue;
      const prev = projectTxnsMap.get(txn.longProjectId) ?? new Prisma.Decimal(0);
      projectTxnsMap.set(txn.longProjectId, prev.plus(txn.amount));
    }
  }

  const longProjectViews: LongProjectView[] = longProjectsRaw.map(p => {
    const spent = projectTxnsMap.get(p.id) ?? new Prisma.Decimal(0);
    const budget = new Prisma.Decimal(p.budget);
    const pctRaw = budget.isZero() ? 0 : spent.div(budget).times(100).toNumber();
    const pct = Math.min(100, Math.round(pctRaw));
    const startLabel = fmtMonthYear(p.startDate);
    const endLabel = p.endDate ? fmtMonthYear(p.endDate) : "…";
    return {
      id: p.id,
      name: p.name,
      sub: p.note ?? (p.category?.name
        ? t("expenses.category.project_category", { vars: { name: p.category.name } })
        : ""),
      pct,
      amountSpent: fmtBase(spent),
      amountTotal: fmtBase(budget),
      dates: `${startLabel} — ${endLabel}`,
      pctTone: pct >= 90 ? "warn" : pct === 0 ? "dim" : undefined,
    };
  });

  // ── Expense categories this month ───────────────────────────
  const catTxns = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      kind: TransactionKind.EXPENSE,
      status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      occurredAt: { gte: monthStart, lte: monthEnd },
      categoryId: { not: null },
    },
    include: {
      category: true,
      facts: { select: { amount: true } },
    },
  });

  const catAmounts = new Map<string, { name: string; amount: Prisma.Decimal }>();
  for (const txn of catTxns) {
    if (!txn.categoryId || !txn.category) continue;
    const actual = txn.status === "DONE"
      ? new Prisma.Decimal(txn.amount)
      : txn.facts.reduce((s, f) => s.plus(f.amount), new Prisma.Decimal(0));
    const inBase = convertToBase(actual, txn.currencyCode, DEFAULT_CURRENCY, rates);
    if (!inBase) continue;
    const prev = catAmounts.get(txn.categoryId);
    catAmounts.set(txn.categoryId, {
      name: txn.category.name,
      amount: (prev?.amount ?? new Prisma.Decimal(0)).plus(inBase),
    });
  }

  let totalCatSpend = new Prisma.Decimal(0);
  for (const v of catAmounts.values()) totalCatSpend = totalCatSpend.plus(v.amount);

  const sortedCats = [...catAmounts.entries()].sort((a, b) => b[1].amount.comparedTo(a[1].amount));

  const BAR_COLORS = ["var(--warn)", "var(--info)", "var(--accent)", "var(--pos)", "var(--neg)"];

  const expenseCategoryViews: ExpenseCategoryView[] = sortedCats.slice(0, 8).map(([id, { name, amount }], i) => {
    const pct = totalCatSpend.isZero() ? 0 : Math.round(amount.div(totalCatSpend).times(100).toNumber());
    return {
      id,
      name,
      sub: "",
      amount: fmtBase(amount),
      pct,
      barColor: BAR_COLORS[i % BAR_COLORS.length],
      usageLabel: t("expenses.category.usage_label", { vars: { pct: String(pct) } }),
      total: t("expenses.category.total_of", { vars: { total: fmtBase(totalCatSpend) } }),
    };
  });

  // ── Build KPI ───────────────────────────────────────────────
  const kpi = {
    sectionTitle: t("expenses.kpi.section_title"),
    sectionMeta: t("expenses.kpi.section_meta"),
    loans: {
      label: t("expenses.kpi.loans"),
      value: Number(loanMonthly.toFixed(0)),
      sub: t("expenses.kpi.loans_sub", { vars: { count: String(loans.length) } }),
    },
    subs: {
      label: t("expenses.kpi.subs"),
      value: Number(subsMonthly.toFixed(0)),
      sub: t("expenses.kpi.subs_sub", { vars: { count: String(subscriptionsGrouped.totals.activeCount) } }),
    },
    utilities: {
      label: t("expenses.kpi.utilities"),
      value: 0,
      sub: t("common.no_data"),
    },
    taxes: {
      label: t("expenses.kpi.taxes"),
      value: 0,
      sub: t("expenses.kpi.taxes_sub"),
    },
    projects: {
      label: t("expenses.kpi.projects"),
      value: longProjectsRaw.length,
      sub: t("expenses.kpi.projects_sub", {
        vars: { budget: fmtBase(longProjectsRaw.reduce((s, p) => s.plus(p.budget), new Prisma.Decimal(0))) },
      }),
    },
  };

  // ── Subscriptions summary view ──────────────────────────────
  const { totals: subTotals, personal, split, paidForOthers } = subscriptionsGrouped;

  function fmtMoney(d: Prisma.Decimal): string {
    const n = Number(d.toFixed(0));
    return n > 0 ? `₽ ${n.toLocaleString("en-US").replace(/,/g," ")}` : "₽ 0";
  }

  const subsMonthlyTotals: SubsMonthlyTotals = {
    personal: fmtMoney(subTotals.personalBase),
    split: fmtMoney(subTotals.splitBase),
    paidForOthers: fmtMoney(subTotals.paidForOthersBase),
    total: fmtMoney(subTotals.monthlyBase),
  };

  const BADGE_MAP: Record<string, "personal" | "split" | "pays"> = {
    PERSONAL: "personal",
    SPLIT: "split",
    PAID_FOR_OTHERS: "pays",
  };

  const BADGE_LABEL: Record<string, string> = {
    PERSONAL: t("expenses.badge.personal"),
    SPLIT: t("expenses.badge.split"),
    PAID_FOR_OTHERS: t("expenses.badge.paid_for_others"),
  };

  const allSubs = [...personal, ...split, ...paidForOthers];

  const INTERVAL_LABEL: Record<number, string> = {
    1: t("expenses.interval.monthly"),
    3: t("expenses.interval.quarterly"),
    6: t("expenses.interval.semiannual"),
    12: t("expenses.interval.annual"),
  };

  function fmtNextDate(d: Date): string {
    const diff = Math.ceil((d.getTime() - now.getTime()) / (24*60*60*1000));
    return `${d.getUTCDate()} ${monthShort[d.getUTCMonth()]} · ${diff}${t("common.unit.day")}`;
  }

  const subItems: SubSummaryItem[] = allSubs.slice(0, 20).map(s => {
    const badge = BADGE_MAP[s.sharingType] ?? "personal";
    const diff = Math.ceil((s.nextPaymentDate.getTime() - now.getTime()) / (24*60*60*1000));
    const nextTone: "warn" | "ok" = diff <= 14 ? "warn" : "ok";
    const sym = s.currencyCode === "RUB" ? "₽" : s.currencyCode === "USD" ? "$" : s.currencyCode === "EUR" ? "€" : s.currencyCode;
    const amountDisplay = `${sym} ${new Prisma.Decimal(s.price).toFixed(s.currencyCode === "RUB" ? 0 : 2)}`;

    return {
      id: s.id,
      icon: s.icon ?? s.name.charAt(0).toUpperCase(),
      iconColor: s.iconColor ?? "var(--text)",
      iconBg: s.iconBg ?? "var(--panel)",
      name: s.name,
      badge,
      badgeLabel: BADGE_LABEL[s.sharingType] ?? t("expenses.badge.personal"),
      period: INTERVAL_LABEL[s.billingIntervalMonths]
        ?? t("expenses.interval.custom", { vars: { n: String(s.billingIntervalMonths) } }),
      note: "",
      amount: amountDisplay,
      next: fmtNextDate(s.nextPaymentDate),
      nextTone,
    };
  });

  return (
    <>
      <ExpensesStatusStrip />
      <ExpensesKpiRow kpi={kpi} />
      {showSection(activeSection, "loans") && <Loans />}
      {showSection(activeSection, "subs") && (
        <Subscriptions items={subItems} totals={subsMonthlyTotals} />
      )}
      {showSection(activeSection, "projects") && (
        <LongProjects projects={longProjectViews} />
      )}
      {showSection(activeSection, "taxes") && <Taxes hints={[]} />}
      {activeSection === "all" && (
        <ExpenseCategories categories={expenseCategoryViews} />
      )}
    </>
  );
}
