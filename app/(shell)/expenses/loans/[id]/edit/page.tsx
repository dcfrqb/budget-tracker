export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { LoanForm } from "@/components/forms/loan-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditLoanPage({ params }: Props) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const [loan, currencies, accounts] = await Promise.all([
    db.loan.findFirst({ where: { id, userId } }),
    db.currency.findMany({ orderBy: { code: "asc" } }),
    db.account.findMany({
      where: { userId, isArchived: false, deletedAt: null },
      orderBy: { name: "asc" },
      include: { currency: true },
    }),
  ]);

  if (!loan) notFound();

  return (
    <div className="page-content">
      <LoanForm
        variant="page"
        mode="edit"
        loanId={id}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          currencyCode: a.currencyCode,
        }))}
        initialValues={{
          name: loan.name,
          principal: String(loan.principal),
          annualRatePct: Number(loan.annualRatePct),
          termMonths: loan.termMonths,
          startDate: loan.startDate.toISOString().slice(0, 10),
          currencyCode: loan.currencyCode,
          accountId: loan.accountId ?? undefined,
          note: loan.note ?? undefined,
        }}
      />
    </div>
  );
}
