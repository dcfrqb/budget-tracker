import { TransactionKind } from "@prisma/client";
import { getCurrentUserId } from "@/lib/api/auth";
import { getCategories } from "@/lib/data/categories";
import { getActiveWorkSources } from "@/lib/data/work-sources";
import { db } from "@/lib/db";
import { TransactionForm } from "@/components/forms/transaction-form";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ kind?: string; description?: string }>;
}

export default async function NewTransactionPage({ searchParams }: Props) {
  const t = await getT();
  const userId = await getCurrentUserId();
  const sp = await searchParams;

  // Resolve kind from query param
  const rawKind = sp.kind?.toUpperCase();
  const kind =
    rawKind && Object.values(TransactionKind).includes(rawKind as TransactionKind)
      ? (rawKind as TransactionKind)
      : undefined;

  // Pre-filled description from one-liner quick input
  const prefillDescription = sp.description
    ? decodeURIComponent(sp.description).slice(0, 240)
    : undefined;

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
    // No accounts — can't create transaction, redirect to wallet
    return (
      <div className="page-content">
        <p className="mut">{t("transactions.new.no_accounts")}</p>
      </div>
    );
  }

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
        defaultName={prefillDescription}
      />
    </div>
  );
}
