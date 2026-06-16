import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { getWorkSourceById } from "@/lib/data/work-sources";
import { db } from "@/lib/db";
import { WorkSourceForm } from "@/components/forms/work-source-form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditWorkSourcePage({ params }: Props) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  const [ws, currencies] = await Promise.all([
    getWorkSourceById(userId, id),
    db.currency.findMany({ orderBy: { code: "asc" } }),
  ]);

  if (!ws) notFound();

  const currencyOptions = currencies.map((c) => ({ code: c.code, symbol: c.symbol }));

  const linkedTxnCount = await db.transaction.count({ where: { workSourceId: id, deletedAt: null } });
  const currencyHasLockedTxns = linkedTxnCount > 0;

  return (
    <div className="page-content">
      <WorkSourceForm
        variant="page"
        mode="edit"
        workSourceId={id}
        currencies={currencyOptions}
        currencyHasLockedTxns={currencyHasLockedTxns}
        initialValues={{
          name: ws.name,
          kind: ws.kind,
          currencyCode: ws.currencyCode,
          rateType: ws.rateType ?? undefined,
          rateAmount: ws.rateAmount?.toString() ?? undefined,
          premiumAmount: ws.premiumAmount?.toString() ?? undefined,
          premiumNote: ws.premiumNote ?? undefined,
          payDay: ws.payDay ?? undefined,
          taxRatePct: ws.taxRatePct ? Number(ws.taxRatePct.toString()) : undefined,
          hoursPerMonth: ws.hoursPerMonth ?? undefined,
          startedAt: ws.startedAt ?? undefined,
          endedAt: ws.endedAt ?? undefined,
          isActive: ws.isActive,
          note: ws.note ?? undefined,
        }}
      />
    </div>
  );
}
