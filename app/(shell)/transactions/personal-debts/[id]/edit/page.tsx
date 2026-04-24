export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { PersonalDebtForm } from "@/components/forms/personal-debt-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditPersonalDebtPage({ params }: Props) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const [debt, currencies, accounts] = await Promise.all([
    db.personalDebt.findFirst({ where: { id, userId } }),
    db.currency.findMany({ orderBy: { code: "asc" } }),
    db.account.findMany({
      where: { userId, isArchived: false, deletedAt: null },
      orderBy: { name: "asc" },
      include: { currency: true },
    }),
  ]);

  if (!debt) notFound();

  return (
    <div className="page-content">
      <PersonalDebtForm
        variant="page"
        mode="edit"
        debtId={id}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          currencyCode: a.currencyCode,
        }))}
        initialValues={{
          counterparty: debt.counterparty,
          principal: String(debt.principal),
          currencyCode: debt.currencyCode,
          openedAt: debt.openedAt.toISOString().slice(0, 10),
          dueAt: debt.dueAt?.toISOString().slice(0, 10) ?? undefined,
          note: debt.note ?? undefined,
        }}
      />
    </div>
  );
}
