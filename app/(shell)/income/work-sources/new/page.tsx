import { getCurrentUserId } from "@/lib/api/auth";
import { resolveUserBaseCurrency } from "@/lib/data/_mutations/work-sources";
import { WorkSourceForm } from "@/components/forms/work-source-form";
import { listAllCurrencies } from "@/lib/data/currencies";

export const dynamic = "force-dynamic";

export default async function NewWorkSourcePage() {
  const userId = await getCurrentUserId();

  const [currencies, defaultCurrencyCode] = await Promise.all([
    listAllCurrencies(),
    resolveUserBaseCurrency(userId),
  ]);

  return (
    <div className="page-content">
      <WorkSourceForm
        variant="page"
        mode="create"
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        defaultCurrencyCode={defaultCurrencyCode}
      />
    </div>
  );
}
