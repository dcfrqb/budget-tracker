import { ImportBar } from "@/components/transactions/import-bar";
import { PeriodSummary } from "@/components/transactions/period-summary";
import { PersonalDebts } from "@/components/transactions/personal-debts";
import { TxnFeed } from "@/components/transactions/txn-feed";
import { TxnStatusStrip } from "@/components/transactions/status-strip";
import { TxnToolbar } from "@/components/transactions/toolbar";
import { DEFAULT_CURRENCY, DEFAULT_USER_ID } from "@/lib/constants";
import {
  getTransactionsGroupedByDay,
  getTransactionsPeriodSummary,
} from "@/lib/data/transactions";
import { getPersonalDebtsWithProgress } from "@/lib/data/debts";
import { getLatestRatesMap } from "@/lib/data/wallet";
import { toPeriodSummaryView, toTxnDayView } from "@/lib/view/transactions";
import { toDebtView } from "@/lib/view/debts";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const today = new Date();
  // 30-дневное окно для сводки и ленты.
  const from = new Date(today.getTime() - 30 * 86400_000);

  const [rawDays, summary, rates, debts] = await Promise.all([
    getTransactionsGroupedByDay(DEFAULT_USER_ID, { from }),
    getTransactionsPeriodSummary(DEFAULT_USER_ID, {
      from,
      to: today,
      baseCcy: DEFAULT_CURRENCY,
    }),
    getLatestRatesMap(),
    getPersonalDebtsWithProgress(DEFAULT_USER_ID, { status: "open" }),
  ]);

  const days = rawDays.map((r) => toTxnDayView(r, today, rates, DEFAULT_CURRENCY));
  const summaryView = toPeriodSummaryView(summary);
  const debtViews = debts.map(toDebtView);

  // net по долгам: Σ(remaining) для OUT минус Σ(remaining) для IN (в base).
  let netDebt = new Prisma.Decimal(0);
  for (const d of debts) {
    const sign = d.direction === "LENT" ? 1 : -1;
    netDebt = netDebt.plus(d.remainingAmount.times(sign));
  }
  const debtMeta = `${debts.length} активно · net ${netDebt.isZero() ? "0" : (netDebt.gt(0) ? "+" : "") + "₽ " + Math.floor(netDebt.toNumber()).toLocaleString("ru-RU").replace(/,/g, " ")} ${netDebt.gt(0) ? "out" : netDebt.lt(0) ? "in" : ""}`.trim();

  return (
    <>
      <TxnStatusStrip />
      <TxnToolbar />
      <PeriodSummary summary={summaryView} />
      <TxnFeed days={days} totalCount={summary.totalCount} />
      <PersonalDebts debts={debtViews} metaLine={debtMeta} />
      <ImportBar />
    </>
  );
}
