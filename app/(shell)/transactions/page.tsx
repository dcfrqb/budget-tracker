import { ImportBar } from "@/components/transactions/import-bar";
import { PeriodSummary } from "@/components/transactions/period-summary";
import { PersonalDebts } from "@/components/transactions/personal-debts";
import { TxnFeed } from "@/components/transactions/txn-feed";
import { TxnStatusStrip } from "@/components/transactions/status-strip";
import { TxnToolbar } from "@/components/transactions/toolbar";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { getT } from "@/lib/i18n/server";
import {
  getTransactionsGroupedByDay,
  getTransactionsPeriodSummary,
} from "@/lib/data/transactions";
import { getPersonalDebtsWithProgress } from "@/lib/data/debts";
import { getLatestRatesMap } from "@/lib/data/wallet";
import { getCategories } from "@/lib/data/categories";
import { db } from "@/lib/db";
import { toPeriodSummaryView, toTxnDayView } from "@/lib/view/transactions";
import { toDebtView } from "@/lib/view/debts";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);
  const today = new Date();
  // 30-дневное окно для сводки и ленты.
  const from = new Date(today.getTime() - 30 * 86400_000);

  const [rawDays, summary, rates, debts, accounts, categories] =
    await Promise.all([
      getTransactionsGroupedByDay(userId, { from }),
      getTransactionsPeriodSummary(userId, {
        from,
        to: today,
        baseCcy: DEFAULT_CURRENCY,
      }),
      getLatestRatesMap(),
      getPersonalDebtsWithProgress(userId, { status: "open" }),
      db.account.findMany({
        where: { userId, deletedAt: null, isArchived: false },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, currencyCode: true },
      }),
      getCategories(userId),
    ]);

  const days = rawDays.map((r) =>
    toTxnDayView(r, today, rates, DEFAULT_CURRENCY),
  );
  const summaryView = toPeriodSummaryView(summary);
  const debtViews = debts.map(toDebtView);

  // net по долгам: Σ(remaining) для OUT минус Σ(remaining) для IN (в base).
  let netDebt = new Prisma.Decimal(0);
  for (const d of debts) {
    const sign = d.direction === "LENT" ? 1 : -1;
    netDebt = netDebt.plus(d.remainingAmount.times(sign));
  }
  const netDebtStr = netDebt.isZero()
    ? "0"
    : `${netDebt.gt(0) ? "+" : ""}₽ ${Math.floor(netDebt.toNumber()).toLocaleString("ru-RU").replace(/,/g, " ")} ${netDebt.gt(0) ? "out" : netDebt.lt(0) ? "in" : ""}`.trim();
  const debtMeta = `${t("transactions.debt_meta", { vars: { count: String(debts.length) } })} ${netDebtStr}`.trim();

  // First non-archived account as default for quick input
  const defaultAccount = accounts[0];

  return (
    <>
      <TxnStatusStrip />
      <TxnToolbar
        defaultAccountId={defaultAccount?.id}
        defaultCurrency={defaultAccount?.currencyCode ?? DEFAULT_CURRENCY}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          kind: c.kind as "INCOME" | "EXPENSE",
        }))}
        accountName={defaultAccount?.name}
      />
      <PeriodSummary summary={summaryView} />
      <TxnFeed days={days} totalCount={summary.totalCount} accounts={accounts} />
      <PersonalDebts debts={debtViews} metaLine={debtMeta} />
      <ImportBar />
    </>
  );
}
