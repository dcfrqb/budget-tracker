import React from "react";
import { PeriodSummary } from "@/components/transactions/period-summary";
import { PersonalDebts } from "@/components/transactions/personal-debts";
import { TxnFeed } from "@/components/transactions/txn-feed";
import { TxnStatusStrip } from "@/components/transactions/status-strip";
import { TxnToolbar } from "@/components/transactions/toolbar";
import { TransactionsSelectionProvider } from "@/components/transactions/selection-context";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { getT, getLocale } from "@/lib/i18n/server";
import { getCurrentUserTz } from "@/lib/data/_users/get-user-tz";
import {
  getTransactionsGroupedByDay,
  getTransactionsPeriodSummary,
  getTransactionById,
  getTransferById,
} from "@/lib/data/transactions";
import { getPersonalDebtsWithProgress } from "@/lib/data/debts";
import { getLatestRatesMap } from "@/lib/data/wallet";
import { getCompensationProjection } from "@/lib/data/_shared/compensation-projection";
import { getCategories } from "@/lib/data/categories";
import { getConnectedCredentials } from "@/lib/data/_queries/integrations";
import { getBudgetSettings } from "@/lib/data/settings";
import { db } from "@/lib/db";
import { toPeriodSummaryView, toTxnDayView } from "@/lib/view/transactions";
import { toDebtView } from "@/lib/view/debts";
import { Prisma, TransactionKind } from "@prisma/client";
import { formatMoney } from "@/lib/format/money";
import { mapDefaultPeriod } from "@/lib/data/_period";
import { isCalendarPeriod, resolveAnyCalendarRange } from "@/lib/analytics/period";
import type { ListFilters } from "@/lib/data/transactions";
import { getActiveWorkSources } from "@/lib/data/work-sources";
import { getActiveBusinesses } from "@/lib/data/businesses";
import { listAllCurrencies } from "@/lib/data/currencies";
import { dayKeyInTz } from "@/lib/format/date";
import { EditSheetHost } from "@/components/transactions/edit-sheet-host";
import { PersonalDebtSheetHost } from "@/components/transactions/personal-debt-sheet-host";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  type?: string;
  period?: string;
  q?: string;
  categoryId?: string;
  accountId?: string;
  edit?: string;
  new?: string;
}>;

// Maps rolling period code to a date range (from, to).
function parseRollingPeriod(period: string): { from: Date; to: Date } {
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
      return [TransactionKind.INCOME, TransactionKind.DEBT_IN];
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
  const userId = await getCurrentUserId();
  const [t, tz, settings] = await Promise.all([
    getT(locale),
    getCurrentUserTz(),
    getBudgetSettings(userId),
  ]);

  const defaultPeriodCode = mapDefaultPeriod(settings?.defaultPeriod ?? "3m", "txn");
  const period = sp.period ?? defaultPeriodCode;

  const { from, to } = isCalendarPeriod(period)
    ? (resolveAnyCalendarRange(period, tz) ?? parseRollingPeriod(defaultPeriodCode))
    : parseRollingPeriod(period);

  const kindFilter = parseKindFilter(sp.type);

  const filters: ListFilters = {
    from,
    to,
    ...(kindFilter ? { kind: kindFilter } : {}),
    ...(sp.q ? { q: sp.q } : {}),
    ...(sp.categoryId ? { categoryId: sp.categoryId } : {}),
    ...(sp.accountId ? { accountId: sp.accountId } : {}),
  };

  const [rawDays, summary, rates, debts, accounts, categories, rawCredentials, proj] =
    await Promise.all([
      getTransactionsGroupedByDay(userId, filters, tz),
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
      getCompensationProjection(userId),
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
    toTxnDayView(r, today, rates, DEFAULT_CURRENCY, t, tz, proj),
  );
  const summaryView = toPeriodSummaryView(summary);
  const debtViews = debts.map((d) => toDebtView(d, t, tz));

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

  // Edit sheet: only fetch when ?edit param is present
  let editSheetNode: React.ReactNode = null;
  const editParam = sp.edit;
  if (editParam) {
    const colonIdx = editParam.indexOf(":");
    const editKind = colonIdx > 0 ? editParam.slice(0, colonIdx) : null;
    const editId = colonIdx > 0 ? editParam.slice(colonIdx + 1) : null;

    if (editKind === "txn" && editId) {
      const [tx, currencies, workSources, businesses] = await Promise.all([
        getTransactionById(userId, editId),
        listAllCurrencies(),
        getActiveWorkSources(userId),
        getActiveBusinesses(userId),
      ]);
      if (tx) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const initialValues: Record<string, any> = {
          accountId: tx.accountId,
          categoryId: tx.categoryId ?? undefined,
          kind: tx.kind,
          status: tx.status,
          amount: tx.amount.toString(),
          currencyCode: tx.currencyCode,
          occurredAt: dayKeyInTz(tx.occurredAt, tz),
          plannedAt: tx.plannedAt ? dayKeyInTz(tx.plannedAt, tz) : undefined,
          name: tx.name,
          note: tx.note ?? undefined,
          scope: tx.scope,
          loanId: tx.loanId ?? undefined,
          subscriptionId: tx.subscriptionId ?? undefined,
          longProjectId: tx.longProjectId ?? undefined,
          fundId: tx.fundId ?? undefined,
          workSourceId: tx.workSourceId ?? undefined,
          personalDebtId: tx.personalDebtId ?? undefined,
          plannedEventId: tx.plannedEventId ?? undefined,
          businessId: tx.businessId ?? undefined,
          businessEntryType: tx.businessEntryType ?? undefined,
        };
        editSheetNode = (
          <EditSheetHost
            kind="txn"
            entityId={editId}
            initialValues={initialValues}
            accounts={accounts}
            categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
            currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
            workSources={workSources.map((w) => ({ id: w.id, name: w.name }))}
            businesses={businesses.map((b) => ({ id: b.id, name: b.name }))}
            tz={tz}
          />
        );
      }
    } else if (editKind === "transfer" && editId) {
      const [transfer, currencies] = await Promise.all([
        getTransferById(userId, editId),
        listAllCurrencies(),
      ]);
      if (transfer) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const initialValues: Record<string, any> = {
          fromAccountId: transfer.fromAccountId,
          toAccountId: transfer.toAccountId,
          fromAmount: transfer.fromAmount.toString(),
          toAmount: transfer.toAmount.toString(),
          rate: transfer.rate?.toString(),
          fee: transfer.fee?.toString(),
          occurredAt: dayKeyInTz(transfer.occurredAt, tz),
          note: transfer.note ?? undefined,
        };
        editSheetNode = (
          <EditSheetHost
            kind="transfer"
            entityId={editId}
            initialValues={initialValues}
            accounts={accounts}
            categories={[]}
            currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
            tz={tz}
          />
        );
      }
    }
  }

  // Debt sheet: only fetch when ?new=debt or ?edit=debt:<id> is present
  let debtSheetNode: React.ReactNode = null;
  const newParam = sp.new;
  const isDebtCreate = newParam === "debt";
  const isDebtEdit = typeof editParam === "string" && editParam.startsWith("debt:");

  if (isDebtCreate || isDebtEdit) {
    const editDebtId = isDebtEdit ? editParam.slice("debt:".length) : null;
    const [debtCurrencies, editDebt] = await Promise.all([
      listAllCurrencies(),
      editDebtId ? db.personalDebt.findFirst({ where: { id: editDebtId, userId } }) : Promise.resolve(null),
    ]);
    const debtInitialValues = editDebt
      ? {
          counterparty: editDebt.counterparty,
          principal: String(editDebt.principal),
          currencyCode: editDebt.currencyCode,
          openedAt: dayKeyInTz(editDebt.openedAt, tz),
          dueAt: editDebt.dueAt ? dayKeyInTz(editDebt.dueAt, tz) : undefined,
          note: editDebt.note ?? undefined,
        }
      : undefined;
    debtSheetNode = (
      <PersonalDebtSheetHost
        currencies={debtCurrencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        accounts={accounts}
        tz={tz}
        debtId={editDebtId ?? undefined}
        initialValues={debtInitialValues}
      />
    );
  }

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
      <TransactionsSelectionProvider>
        <TxnFeed days={days} totalCount={summary.totalCount} accounts={accounts} tz={tz} />
      </TransactionsSelectionProvider>
      <PersonalDebts debts={debtViews} metaLine={debtMeta} tz={tz} />
      {editSheetNode}
      {debtSheetNode}
    </>
  );
}
