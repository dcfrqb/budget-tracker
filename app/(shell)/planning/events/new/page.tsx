export const dynamic = "force-dynamic";

import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { PlannedEventForm } from "@/components/forms/planned-event-form";
import { listAllCurrencies } from "@/lib/data/currencies";

type SearchParams = Promise<{ date?: string }>;

export default async function NewPlannedEventPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const userId = await getCurrentUserId();
  const sp = searchParams ? await searchParams : {};

  const prefillDate =
    typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)
      ? sp.date
      : undefined;

  const [currencies, funds] = await Promise.all([
    listAllCurrencies(),
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
        initialValues={prefillDate ? { eventDate: prefillDate } : undefined}
      />
    </div>
  );
}
