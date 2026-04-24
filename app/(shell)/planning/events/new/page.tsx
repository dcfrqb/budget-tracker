export const dynamic = "force-dynamic";

import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { PlannedEventForm } from "@/components/forms/planned-event-form";

export default async function NewPlannedEventPage() {
  const userId = await getCurrentUserId();

  const [currencies, funds] = await Promise.all([
    db.currency.findMany({ orderBy: { code: "asc" } }),
    db.fund.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="page-content">
      <PlannedEventForm
        variant="page"
        mode="create"
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        funds={funds}
      />
    </div>
  );
}
