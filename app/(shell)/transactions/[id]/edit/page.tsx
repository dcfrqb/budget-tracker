import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { getTransactionById } from "@/lib/data/transactions";
import { getCategories } from "@/lib/data/categories";
import { getActiveWorkSources } from "@/lib/data/work-sources";
import { db } from "@/lib/db";
import { TransactionForm } from "@/components/forms/transaction-form";
import type { TransactionCreateInput } from "@/lib/validation/transaction";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditTransactionPage({ params }: Props) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  const [tx, accounts, categories, currencies, workSources] = await Promise.all([
    getTransactionById(userId, id),
    db.account.findMany({
      where: { userId, deletedAt: null, isArchived: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, currencyCode: true },
    }),
    getCategories(userId),
    db.currency.findMany({ orderBy: { code: "asc" } }),
    getActiveWorkSources(userId),
  ]);

  if (!tx) notFound();

  // Map transaction to form initial values
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialValues: Record<string, any> = {
    accountId: tx.accountId,
    categoryId: tx.categoryId ?? undefined,
    kind: tx.kind,
    status: tx.status,
    amount: tx.amount.toString(),
    currencyCode: tx.currencyCode,
    occurredAt: tx.occurredAt.toISOString().slice(0, 10),
    plannedAt: tx.plannedAt?.toISOString().slice(0, 10),
    name: tx.name,
    note: tx.note ?? undefined,
    scope: tx.scope,
    isReimbursable: tx.isReimbursable,
    reimbursementFromName: tx.reimbursementFromName ?? undefined,
    expectedReimbursement: tx.expectedReimbursement?.toString(),
    loanId: tx.loanId ?? undefined,
    subscriptionId: tx.subscriptionId ?? undefined,
    longProjectId: tx.longProjectId ?? undefined,
    fundId: tx.fundId ?? undefined,
    workSourceId: tx.workSourceId ?? undefined,
    personalDebtId: tx.personalDebtId ?? undefined,
    plannedEventId: tx.plannedEventId ?? undefined,
  };

  return (
    <div className="page-content">
      <TransactionForm
        variant="page"
        mode="edit"
        transactionId={id}
        accounts={accounts}
        categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        workSources={workSources.map((w) => ({ id: w.id, name: w.name }))}
        initialValues={initialValues}
        defaultKind={tx.kind}
      />
    </div>
  );
}
