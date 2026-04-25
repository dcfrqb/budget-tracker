import { ExpectedIncome } from "@/components/income/expected";
import { IncomeKpiRow } from "@/components/income/kpi-row";
import { IncomeSignals } from "@/components/income/signals";
import { IncomeStatusStrip } from "@/components/income/status-strip";
import { OtherIncome } from "@/components/income/other-income";
import { WorkSourcesSection } from "@/components/income/work-sources";
import type { WorkSourceCardView } from "@/components/income/work-sources";
import { DEFAULT_CURRENCY, HOURS_PER_MONTH_DEFAULT } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { getActiveWorkSources } from "@/lib/data/work-sources";
import { getLatestRatesMap, convertToBase } from "@/lib/data/wallet";
import { getT } from "@/lib/i18n/server";
import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { formatAmount, formatRubPrefix } from "@/lib/format/money";
import type { ExpectedRow } from "@/components/income/expected";
import type { OtherIncomeRow } from "@/components/income/other-income";

const CCY_SHAPES: Record<string, { code: string; symbol: string; decimals: number }> = {
  RUB: { code: "RUB", symbol: "₽", decimals: 2 },
  USD: { code: "USD", symbol: "$", decimals: 2 },
  EUR: { code: "EUR", symbol: "€", decimals: 2 },
};

function fmtWorkMoney(amount: Prisma.Decimal, ccy: string): string {
  const shape = CCY_SHAPES[ccy] ?? { code: ccy, symbol: ccy, decimals: 2 };
  return formatAmount(amount, shape);
}

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  tab?: string;
  period?: string;
}>;

const MONTH_KEYS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] as const;
const WEEKDAY_KEYS = ["sun","mon","tue","wed","thu","fri","sat"] as const;

function formatDate(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2,"0")}.${String(d.getUTCMonth()+1).padStart(2,"0")}`;
}

function diffDays(a: Date, b: Date): number {
  return Math.ceil((a.getTime() - b.getTime()) / (24*60*60*1000));
}

type PeriodValue = "30d" | "90d" | "1y" | "all";

// Maps period param to a look-ahead window in days for upcoming income.
function parseExpectedWindow(period: string | undefined): number {
  switch (period) {
    case "30d":  return 30;
    case "1y":   return 365;
    case "all":  return 3650; // ~10 years
    case "90d":
    default:     return 90;
  }
}

// Maps period param to a look-back window in days for other (past) income.
function parseHistoryWindow(period: string | undefined): number {
  switch (period) {
    case "30d":  return 30;
    case "1y":   return 365;
    case "all":  return 3650;
    case "90d":
    default:     return 90;
  }
}

// Maps period to a { from, to } window used for the inflow KPI.
function periodToWindow(period: PeriodValue, now: Date): { from: Date; to: Date } {
  switch (period) {
    case "30d":  return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
    case "1y":   return { from: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), to: now };
    case "all":  return { from: new Date(0), to: now };
    case "90d":
    default:     return { from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), to: now };
  }
}

export default async function IncomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);

  // active tab: "sources" | "expected" | "other" (default: "sources")
  const activeTab = sp.tab ?? "sources";
  const expectedWindowDays = parseExpectedWindow(sp.period);
  const historyWindowDays = parseHistoryWindow(sp.period);

  const monthShort = MONTH_KEYS.map(k => t(`common.month.short.${k}` as Parameters<typeof t>[0]));
  const weekdayShort = WEEKDAY_KEYS.map(k => t(`common.weekday.short.${k}` as Parameters<typeof t>[0]));

  function formatWeekday(d: Date): string {
    return weekdayShort[d.getUTCDay()];
  }

  function formatDaysDiff(d: Date): string {
    const diff = diffDays(d, new Date());
    if (diff <= 0) return t("income.today");
    return t("income.in_days", { vars: { n: String(diff) } });
  }

  function shortDate(d: Date): string {
    return `${d.getUTCDate()} ${monthShort[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + expectedWindowDays * 24 * 60 * 60 * 1000);
  const historyStart = new Date(now.getTime() - historyWindowDays * 24 * 60 * 60 * 1000);

  const periodValue = (["30d", "90d", "1y", "all"].includes(sp.period ?? "") ? sp.period : "90d") as PeriodValue;
  let kpiWindow = periodToWindow(periodValue, now);

  const [workSources, rates] = await Promise.all([
    getActiveWorkSources(userId),
    getLatestRatesMap(),
  ]);

  // For "all" period, find the earliest income transaction to avoid epoch-based window
  // which would produce nonsense day counts like "20089 д · ср X / мес".
  if (periodValue === "all") {
    const earliest = await db.transaction.findFirst({
      where: { userId, deletedAt: null, kind: TransactionKind.INCOME },
      orderBy: { occurredAt: "asc" },
      select: { occurredAt: true },
    });
    if (earliest) {
      kpiWindow = { from: earliest.occurredAt, to: now };
    } else {
      // No income transactions yet — zero-day window, avg sub-label will be skipped below
      kpiWindow = { from: now, to: now };
    }
  }

  // Inflow KPI — DONE+PARTIAL income within the selected period window
  const inflowRows = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      kind: TransactionKind.INCOME,
      status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      occurredAt: { gte: kpiWindow.from, lte: kpiWindow.to },
    },
    select: { amount: true, currencyCode: true, status: true, facts: { select: { amount: true } } },
  });

  let inflowTotal = new Prisma.Decimal(0);
  for (const txn of inflowRows) {
    const actual = txn.status === "DONE"
      ? new Prisma.Decimal(txn.amount)
      : txn.facts.reduce((s, f) => s.plus(f.amount), new Prisma.Decimal(0));
    const inBase = convertToBase(actual, txn.currencyCode, DEFAULT_CURRENCY, rates);
    if (inBase) inflowTotal = inflowTotal.plus(inBase);
  }

  const inflowWindowDaysRaw = Math.ceil((kpiWindow.to.getTime() - kpiWindow.from.getTime()) / (24 * 60 * 60 * 1000));
  const inflowWindowDays = Math.max(1, inflowWindowDaysRaw);
  const hasInflowData = inflowWindowDaysRaw > 0;
  const inflowAvgPerMonth = inflowTotal.div(inflowWindowDays).mul(30).toFixed(0);

  // Hourly rate from primary work source
  let hourlyRate = 0;
  if (workSources.length > 0) {
    const primary = workSources[0];
    if (primary.hourlyRate) {
      hourlyRate = Number(new Prisma.Decimal(primary.hourlyRate).toFixed(0));
    } else if (primary.baseAmount) {
      const hpm = primary.hoursPerMonth ?? HOURS_PER_MONTH_DEFAULT;
      hourlyRate = Number(new Prisma.Decimal(primary.baseAmount).div(hpm).toFixed(0));
    }
  }

  // Map WorkSource records → WorkSourceCardView
  const workSourceViews: WorkSourceCardView[] = workSources.map(ws => {
    const kindLabel =
      ws.kind === "EMPLOYMENT"
        ? t("income.work.kind_label.employment")
        : ws.kind === "FREELANCE"
        ? t("income.work.kind_label.freelance")
        : t("income.work.kind_label.one_time");

    let taxLabel: string | undefined;
    if (ws.taxRatePct) {
      const pct = new Prisma.Decimal(ws.taxRatePct).toFixed(0);
      // Heuristic: 6% → self-employed / Самозанятый; 13% → NDFL; others → plain %
      if (ws.taxRatePct.equals(6)) {
        taxLabel = t("income.work.tax.szn", { vars: { pct } });
      } else if (ws.taxRatePct.equals(13)) {
        taxLabel = t("income.work.tax.ndfl", { vars: { pct } });
      } else {
        taxLabel = `${pct}%`;
      }
    } else {
      taxLabel = t("income.work.tax.none");
    }

    return {
      id: ws.id,
      kind: ws.kind as WorkSourceCardView["kind"],
      kindLabel,
      name: ws.name,
      sub: ws.note ?? undefined,
      currencyCode: ws.currencyCode,
      baseAmount: ws.baseAmount
        ? fmtWorkMoney(new Prisma.Decimal(ws.baseAmount), ws.currencyCode)
        : undefined,
      hourlyRate: ws.hourlyRate
        ? fmtWorkMoney(new Prisma.Decimal(ws.hourlyRate), ws.currencyCode) + "/h"
        : undefined,
      payDay: ws.payDay,
      taxLabel,
      isActive: ws.isActive,
    };
  });

  // Active sources count
  const sourceCount = workSources.length;

  const inflowLabel = t(`income.kpi.inflow_label.${periodValue}` as Parameters<typeof t>[0]);

  const kpi = {
    ytd: {
      value: Number(inflowTotal.toFixed(0)),
      label: inflowLabel,
      sub: hasInflowData
        ? t("income.kpi.inflow_sub", {
            vars: {
              days: String(inflowWindowDays),
              avg: formatRubPrefix(new Prisma.Decimal(inflowAvgPerMonth)),
            },
          })
        : "",
    },
    sources: {
      value: sourceCount,
      label: t("income.kpi.sources_label"),
      sub: sourceCount > 0
        ? t("income.kpi.sources_sub_work", {
            vars: {
              work: String(workSources.filter(s => s.kind === "EMPLOYMENT").length),
              freelance: String(workSources.filter(s => s.kind === "FREELANCE").length),
            },
          })
        : t("income.kpi.sources_empty"),
    },
    tax: {
      value: 0,
      label: t("income.kpi.tax_label"),
      sub: t("income.kpi.tax_sub"),
    },
    rate: {
      value: hourlyRate,
      label: t("income.kpi.rate_label"),
      sub: hourlyRate > 0 ? t("income.kpi.rate_sub_primary") : t("income.kpi.rate_sub_empty"),
    },
  };

  // Expected income — PLANNED INCOME transactions in next N days
  const plannedRows = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      kind: TransactionKind.INCOME,
      status: TransactionStatus.PLANNED,
      occurredAt: { gte: now, lte: windowEnd },
    },
    include: {
      account: { include: { institution: true } },
      workSource: true,
    },
    orderBy: { occurredAt: "asc" },
  });

  const RU_CCY: Record<string, string> = { RUB: "₽", USD: "$", EUR: "€" };

  const expectedRows: ExpectedRow[] = plannedRows.map(txn => {
    const sym = RU_CCY[txn.currencyCode] ?? txn.currencyCode;
    const src = txn.workSource?.name ?? txn.account.institution?.name ?? txn.account.name;
    return {
      id: txn.id,
      date: formatDate(txn.occurredAt),
      weekday: formatWeekday(txn.occurredAt),
      inDays: formatDaysDiff(txn.occurredAt),
      name: txn.name,
      sub: txn.note ?? "",
      src,
      status: "expected" as const,
      statusLabel: t("income.expected.status_label"),
      amount: `+${sym} ${new Prisma.Decimal(txn.amount).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g," ")}`,
    };
  });

  // Other income — DONE INCOME transactions NOT linked to a work source, last N days
  const otherRows = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      kind: TransactionKind.INCOME,
      status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      workSourceId: null,
      occurredAt: { gte: historyStart, lte: now },
    },
    include: { account: { include: { institution: true } } },
    orderBy: { occurredAt: "desc" },
    take: 10,
  });

  const otherIncomeRows: OtherIncomeRow[] = otherRows.map(txn => {
    const sym = RU_CCY[txn.currencyCode] ?? txn.currencyCode;
    const src = txn.account.institution?.name ?? txn.account.name;
    const firstChar = txn.name.charAt(0).toUpperCase();
    return {
      id: txn.id,
      icon: firstChar,
      name: txn.name,
      sub: txn.note ?? "",
      src,
      date: shortDate(txn.occurredAt),
      amount: `+${sym} ${new Prisma.Decimal(txn.amount).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g," ")}`,
    };
  });

  return (
    <>
      <IncomeStatusStrip />
      <IncomeKpiRow kpi={kpi} />
      {(activeTab === "sources") && <WorkSourcesSection items={workSourceViews} />}
      {(activeTab === "expected") && <ExpectedIncome rows={expectedRows} />}
      {(activeTab === "other") && <OtherIncome rows={otherIncomeRows} />}
      {(activeTab === "sources") && <IncomeSignals signals={[]} />}
    </>
  );
}
