import { getCurrentUserId } from "@/lib/api/auth";
import { resolveUserBaseCurrency } from "@/lib/data/_mutations/work-sources";
import { BusinessForm } from "@/components/forms/business-form";
import { listAllCurrencies } from "@/lib/data/currencies";

export const dynamic = "force-dynamic";

export default async function NewBusinessPage() {
  const userId = await getCurrentUserId();

  const [currencies, defaultCurrencyCode] = await Promise.all([
    listAllCurrencies(),
    resolveUserBaseCurrency(userId),
  ]);

  return (
    <div className="page-content">
      <BusinessForm
        variant="page"
        mode="create"
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        defaultCurrencyCode={defaultCurrencyCode}
      />
    </div>
  );
}
