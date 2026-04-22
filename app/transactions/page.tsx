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
import { toPeriodSummaryView, toTxnDayView } from "@/lib/view/transactions";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const today = new Date();
  // 30-дневное окно для сводки и ленты.
  const from = new Date(today.getTime() - 30 * 86400_000);

  const [rawDays, summary] = await Promise.all([
    getTransactionsGroupedByDay(DEFAULT_USER_ID, { from }),
    getTransactionsPeriodSummary(DEFAULT_USER_ID, {
      from,
      to: today,
      baseCcy: DEFAULT_CURRENCY,
    }),
  ]);

  const days = rawDays.map((r) => toTxnDayView(r, today));
  const summaryView = toPeriodSummaryView(summary);

  return (
    <>
      <TxnStatusStrip />
      <TxnToolbar />
      <PeriodSummary summary={summaryView} />
      <TxnFeed days={days} totalCount={summary.totalCount} />
      <PersonalDebts />
      <ImportBar />
    </>
  );
}
