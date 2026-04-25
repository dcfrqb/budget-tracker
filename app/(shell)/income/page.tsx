import { ExpectedIncome } from "@/components/income/expected";
import { IncomeKpiRow } from "@/components/income/kpi-row";
import { IncomeSignals } from "@/components/income/signals";
import { IncomeStatusStrip } from "@/components/income/status-strip";
import { OtherIncome } from "@/components/income/other-income";
import { WorkSourcesSection } from "@/components/income/work-sources";
import { DEFAULT_CURRENCY, HOURS_PER_MONTH_DEFAULT } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { getActiveWorkSources } from "@/lib/data/work-sources";
import { getLatestRatesMap, convertToBase } from "@/lib/data/wallet";
import { getT } from "@/lib/i18n/server";
import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { formatRubPrefix } from "@/lib/format/money";
import type { ExpectedRow } from "@/components/income/expected";
import type { OtherIncomeRow } from "@/components/income/other-income";

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
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const monthsElapsed = now.getUTCMonth() + 1;
  const windowEnd = new Date(now.getTime() + expectedWindowDays * 24 * 60 * 60 * 1000);
  const historyStart = new Date(now.getTime() - historyWindowDays * 24 * 60 * 60 * 1000);

  const [workSources, rates] = await Promise.all([
    getActiveWorkSources(userId),
    getLatestRatesMap(),
  ]);

  // YTD income (DONE+PARTIAL)
  const ytdRows = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      kind: TransactionKind.INCOME,
      status: { in: [TransactionStatus.DONE, TransactionStatus.PARTIAL] },
      occurredAt: { gte: yearStart, lte: now },
    },
    select: { amount: true, currencyCode: true, status: true, facts: { select: { amount: true } } },
  });

  let ytdTotal = new Prisma.Decimal(0);
  for (const txn of ytdRows) {
    const actual = txn.status === "DONE"
      ? new Prisma.Decimal(txn.amount)
      : txn.facts.reduce((s, f) => s.plus(f.amount), new Prisma.Decimal(0));
    const inBase = convertToBase(actual, txn.currencyCode, DEFAULT_CURRENCY, rates);
    if (inBase) ytdTotal = ytdTotal.plus(inBase);
  }

  const ytdAvgPerMonth = monthsElapsed > 0
    ? ytdTotal.div(monthsElapsed).toFixed(0)
    : "0";

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

  // Active sources count
  const sourceCount = workSources.length;

  const kpi = {
    ytd: {
      value: Number(ytdTotal.toFixed(0)),
      sub: t("income.kpi.ytd_sub", {
        vars: {
          months: String(monthsElapsed),
          avg: formatRubPrefix(new Prisma.Decimal(ytdAvgPerMonth)),
        },
      }),
    },
    sources: {
      value: sourceCount,
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
      sub: t("income.kpi.tax_sub"),
    },
    rate: {
      value: hourlyRate,
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
      {(activeTab === "sources") && <WorkSourcesSection />}
      {(activeTab === "expected") && <ExpectedIncome rows={expectedRows} />}
      {(activeTab === "other") && <OtherIncome rows={otherIncomeRows} />}
      {(activeTab === "sources") && <IncomeSignals signals={[]} />}
    </>
  );
}
