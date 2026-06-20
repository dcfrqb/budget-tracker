import { listAllCurrencies } from "@/lib/data/currencies";
import { SubscriptionForm } from "@/components/forms/subscription-form";

export const dynamic = "force-dynamic";

export default async function NewSubscriptionPage() {
  const currencies = await listAllCurrencies();

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
