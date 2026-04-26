import { TransactionKind, TransactionStatus } from "@prisma/client";
import { getCurrentUserId } from "@/lib/api/auth";
import { getCategories } from "@/lib/data/categories";
import { getActiveWorkSources } from "@/lib/data/work-sources";
import { db } from "@/lib/db";
import { TransactionForm } from "@/components/forms/transaction-form";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    kind?: string;
    description?: string;
    status?: string;
    amount?: string;
    currency?: string;
    category?: string;
    accountId?: string;
    date?: string;
  }>;
}

// ISO date regex (YYYY-MM-DD)
const RE_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function NewTransactionPage({ searchParams }: Props) {
  const t = await getT();
  const userId = await getCurrentUserId();
  const sp = await searchParams;

  const [accounts, categories, currencies, workSources] = await Promise.all([
    db.account.findMany({
      where: { userId, deletedAt: null, isArchived: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, currencyCode: true },
    }),
    getCategories(userId),
    db.currency.findMany({ orderBy: { code: "asc" } }),
    getActiveWorkSources(userId),
  ]);

  if (accounts.length === 0) {
    return (
      <div className="page-content">
        <p className="mut">{t("transactions.new.no_accounts")}</p>
      </div>
    );
  }

  // --- Validate each searchParam against in-DB sets; ignore bad values silently ---

  // kind
  const rawKind = sp.kind?.toUpperCase();
  const kind =
    rawKind && Object.values(TransactionKind).includes(rawKind as TransactionKind)
      ? (rawKind as TransactionKind)
      : undefined;

  // status
  const rawStatus = sp.status?.toUpperCase();
  const status =
    rawStatus && Object.values(TransactionStatus).includes(rawStatus as TransactionStatus)
      ? (rawStatus as TransactionStatus)
      : undefined;

  // description
  const prefillDescription = sp.description
    ? decodeURIComponent(sp.description).slice(0, 240)
    : undefined;

  // amount — must be a positive finite number
  let prefillAmount: string | undefined;
  if (sp.amount) {
    const n = parseFloat(sp.amount);
    if (isFinite(n) && n > 0) prefillAmount = n.toFixed(2);
  }

  // currency — must exist in DB
  const currencyCodes = new Set(currencies.map((c) => c.code));
  const prefillCurrency =
    sp.currency && currencyCodes.has(sp.currency.toUpperCase())
      ? sp.currency.toUpperCase()
      : undefined;

  // category — must exist in DB and belong to this user
  const categoryIds = new Set(categories.map((c) => c.id));
  const prefillCategoryId =
    sp.category && categoryIds.has(sp.category) ? sp.category : undefined;

  // accountId — must exist in DB and belong to this user
  const accountIds = new Set(accounts.map((a) => a.id));
  const prefillAccountId =
    sp.accountId && accountIds.has(sp.accountId) ? sp.accountId : undefined;

  // date — must match YYYY-MM-DD
  const prefillDate =
    sp.date && RE_ISO_DATE.test(sp.date) ? sp.date : undefined;

  // Build initialValues only for fields that have valid prefill values
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialValues: Record<string, any> = {};
  if (kind) initialValues.kind = kind;
  if (status) initialValues.status = status;
  if (prefillDescription) initialValues.name = prefillDescription;
  if (prefillAmount) initialValues.amount = prefillAmount;
  if (prefillCurrency) initialValues.currencyCode = prefillCurrency;
  if (prefillCategoryId) initialValues.categoryId = prefillCategoryId;
  if (prefillAccountId) initialValues.accountId = prefillAccountId;
  if (prefillDate) initialValues.occurredAt = prefillDate;

  return (
    <div className="page-content">
      <TransactionForm
        variant="page"
        mode="create"
        accounts={accounts}
        categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        workSources={workSources.map((w) => ({ id: w.id, name: w.name }))}
        defaultKind={kind}
        defaultStatus={status}
        defaultName={prefillDescription}
        initialValues={Object.keys(initialValues).length > 0 ? initialValues : undefined}
      />
    </div>
  );
}
