import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { getWorkSourceById, getCandidateTxnsForOrder } from "@/lib/data/work-sources";
import { getFreelanceOrdersByWorkSource, getLinkedPaymentsByOrderIds } from "@/lib/data/freelance-orders";
import type { LinkedPaymentRow } from "@/lib/data/freelance-orders";
import { db } from "@/lib/db";
import { WorkSourceForm } from "@/components/forms/work-source-form";
import { FreelanceOrdersSection } from "@/components/income/freelance-orders-section";

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

  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const candidateBounds = { from: twelveMonthsAgo, to: now };

  const [orders, linkedTxnCount, candidates] = await Promise.all([
    ws.kind === "FREELANCE"
      ? getFreelanceOrdersByWorkSource(userId, id)
      : Promise.resolve([]),
    db.transaction.count({ where: { workSourceId: id, deletedAt: null } }),
    ws.kind === "FREELANCE"
      ? getCandidateTxnsForOrder(userId, id, candidateBounds)
      : Promise.resolve([]),
  ]);

  const currencyHasLockedTxns = linkedTxnCount > 0;

  const orderIds = orders.map((o) => o.id);
  const linkedPaymentsFlat = ws.kind === "FREELANCE" && orderIds.length > 0
    ? await getLinkedPaymentsByOrderIds(userId, orderIds)
    : [];

  const linkedPaymentsByOrder: Record<string, LinkedPaymentRow[]> = {};
  for (const p of linkedPaymentsFlat) {
    if (!linkedPaymentsByOrder[p.freelanceOrderId]) {
      linkedPaymentsByOrder[p.freelanceOrderId] = [];
    }
    linkedPaymentsByOrder[p.freelanceOrderId].push(p);
  }

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
      {ws.kind === "FREELANCE" && (
        <FreelanceOrdersSection
          workSourceId={id}
          workSourceCurrency={ws.currencyCode}
          currencies={currencyOptions}
          initialOrders={orders}
          linkedPaymentsByOrder={linkedPaymentsByOrder}
          candidates={candidates}
        />
      )}
    </div>
  );
}
