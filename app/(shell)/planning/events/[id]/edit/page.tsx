export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { PlannedEventForm } from "@/components/forms/planned-event-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditPlannedEventPage({ params }: Props) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const [event, currencies, funds] = await Promise.all([
    db.plannedEvent.findFirst({ where: { id, userId } }),
    db.currency.findMany({ orderBy: { code: "asc" } }),
    db.fund.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!event) notFound();

  return (
    <div className="page-content">
      <PlannedEventForm
        variant="page"
        mode="edit"
        eventId={id}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        funds={funds}
        initialValues={{
          kind: event.kind,
          name: event.name,
          note: event.note ?? undefined,
          eventDate: event.eventDate.toISOString().slice(0, 10),
          repeatsYearly: event.repeatsYearly,
          fundId: event.fundId ?? undefined,
          expectedAmount: event.expectedAmount != null ? String(event.expectedAmount) : undefined,
          currencyCode: event.currencyCode ?? undefined,
        }}
      />
    </div>
  );
}
