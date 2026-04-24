export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { FundForm } from "@/components/forms/fund-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditFundPage({ params }: Props) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const [fund, currencies] = await Promise.all([
    db.fund.findFirst({ where: { id, userId } }),
    db.currency.findMany({ orderBy: { code: "asc" } }),
  ]);

  if (!fund) notFound();

  return (
    <div className="page-content">
      <FundForm
        variant="page"
        mode="edit"
        fundId={id}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        initialValues={{
          kind: fund.kind,
          name: fund.name,
          note: fund.note ?? undefined,
          goalAmount: String(fund.goalAmount),
          currentAmount: String(fund.currentAmount),
          monthlyContribution: fund.monthlyContribution != null ? String(fund.monthlyContribution) : undefined,
          targetDate: fund.targetDate ? fund.targetDate.toISOString().slice(0, 10) : undefined,
          currencyCode: fund.currencyCode,
        }}
      />
    </div>
  );
}
