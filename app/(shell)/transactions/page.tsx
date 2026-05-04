import { PeriodSummary } from "@/components/transactions/period-summary";
import { PersonalDebts } from "@/components/transactions/personal-debts";
import { TxnFeed } from "@/components/transactions/txn-feed";
import { TxnStatusStrip } from "@/components/transactions/status-strip";
import { TxnToolbar } from "@/components/transactions/toolbar";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { getT, getLocale } from "@/lib/i18n/server";
import {
  getTransactionsGroupedByDay,
  getTransactionsPeriodSummary,
} from "@/lib/data/transactions";
import { getPersonalDebtsWithProgress } from "@/lib/data/debts";
import { getLatestRatesMap } from "@/lib/data/wallet";
import { getCategories } from "@/lib/data/categories";
import { getConnectedCredentials } from "@/lib/data/_queries/integrations";
import { db } from "@/lib/db";
import { toPeriodSummaryView, toTxnDayView } from "@/lib/view/transactions";
import { toDebtView } from "@/lib/view/debts";
import { Prisma, TransactionKind } from "@prisma/client";
import { formatMoney } from "@/lib/format/money";
import type { ListFilters } from "@/lib/data/transactions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  type?: string;
  period?: string;
  q?: string;
  categoryId?: string;
  accountId?: string;
}>;

// Maps URL period param to a date range (from, to).
function parsePeriod(period: string | undefined): { from: Date; to: Date } {
  const to = new Date();
  let from: Date;
  switch (period) {
    case "7d":
      from = new Date(to.getTime() - 7 * 86400_000);
      break;
    case "90d":
      from = new Date(to.getTime() - 90 * 86400_000);
      break;
    case "1y":
      from = new Date(to.getTime() - 365 * 86400_000);
      break;
    case "30d":
    default:
      from = new Date(to.getTime() - 30 * 86400_000);
      break;
  }
  return { from, to };
}

// Maps URL type param to TransactionKind[].
function parseKindFilter(type: string | undefined): TransactionKind[] | undefined {
  switch (type) {
    case "inc":
      return [TransactionKind.INCOME, TransactionKind.REIMBURSEMENT, TransactionKind.DEBT_IN];
    case "exp":
      return [TransactionKind.EXPENSE, TransactionKind.LOAN_PAYMENT, TransactionKind.DEBT_OUT];
    case "xfr":
      return [TransactionKind.TRANSFER];
    case "loan":
      return [TransactionKind.LOAN_PAYMENT, TransactionKind.DEBT_IN, TransactionKind.DEBT_OUT];
    case "all":
    default:
      return undefined;
  }
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const [userId, t] = await Promise.all([getCurrentUserId(), getT(locale)]);

  const { from, to } = parsePeriod(sp.period);
  const kindFilter = parseKindFilter(sp.type);

  const filters: ListFilters = {
    from,
    to,
    ...(kindFilter ? { kind: kindFilter } : {}),
    ...(sp.q ? { q: sp.q } : {}),
    ...(sp.categoryId ? { categoryId: sp.categoryId } : {}),
    ...(sp.accountId ? { accountId: sp.accountId } : {}),
  };

  const [rawDays, summary, rates, debts, accounts, categories, rawCredentials] =
    await Promise.all([
      getTransactionsGroupedByDay(userId, filters),
      getTransactionsPeriodSummary(userId, {
        from,
        to,
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
      getConnectedCredentials(userId),
    ]);

  const syncCredentials = rawCredentials.map((c) => ({
    id: c.id,
    adapterId: c.adapterId,
    displayLabel: c.displayLabel,
    lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
    lastErrorAt: c.lastErrorAt?.toISOString() ?? null,
  }));

  const today = new Date();
  const days = rawDays.map((r) =>
    toTxnDayView(r, today, rates, DEFAULT_CURRENCY, t),
  );
  const summaryView = toPeriodSummaryView(summary);
  const debtViews = debts.map((d) => toDebtView(d, t));

  // net по долгам: Σ(remaining) для OUT минус Σ(remaining) для IN (в base).
  let netDebt = new Prisma.Decimal(0);
  for (const d of debts) {
    const sign = d.direction === "LENT" ? 1 : -1;
    netDebt = netDebt.plus(d.remainingAmount.times(sign));
  }
  const netDebtStr = netDebt.isZero()
    ? "0"
    : `${netDebt.gt(0) ? "+" : ""}${formatMoney(netDebt.abs(), "RUB")} ${netDebt.gt(0) ? "out" : netDebt.lt(0) ? "in" : ""}`.trim();
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
        syncCredentials={syncCredentials}
      />
      <PeriodSummary summary={summaryView} />
      <TxnFeed days={days} totalCount={summary.totalCount} accounts={accounts} />
      <PersonalDebts debts={debtViews} metaLine={debtMeta} />
    </>
  );
}
