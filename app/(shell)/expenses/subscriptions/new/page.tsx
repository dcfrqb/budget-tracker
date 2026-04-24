export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { SubscriptionForm } from "@/components/forms/subscription-form";

export default async function NewSubscriptionPage() {
  const currencies = await db.currency.findMany({ orderBy: { code: "asc" } });

  return (
    <div className="page-content">
      <SubscriptionForm
        variant="page"
        mode="create"
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
      />
    </div>
  );
}
