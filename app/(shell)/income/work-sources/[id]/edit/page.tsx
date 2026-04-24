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

  return (
    <div className="page-content">
      <WorkSourceForm
        variant="page"
        mode="edit"
        workSourceId={id}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        initialValues={{
          name: ws.name,
          kind: ws.kind,
          currencyCode: ws.currencyCode,
          baseAmount: ws.baseAmount?.toString(),
          hourlyRate: ws.hourlyRate?.toString(),
          payDay: ws.payDay ?? undefined,
          taxRatePct: ws.taxRatePct ? Number(ws.taxRatePct.toString()) : undefined,
          hoursPerMonth: ws.hoursPerMonth ?? undefined,
          isActive: ws.isActive,
          notes: ws.note ?? undefined,
        }}
      />
    </div>
  );
}
