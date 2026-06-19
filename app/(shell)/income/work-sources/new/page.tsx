import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { resolveUserBaseCurrency } from "@/lib/data/_mutations/work-sources";
import { WorkSourceForm } from "@/components/forms/work-source-form";

export const dynamic = "force-dynamic";

export default async function NewWorkSourcePage() {
  const userId = await getCurrentUserId();

  const [currencies, defaultCurrencyCode] = await Promise.all([
    db.currency.findMany({ orderBy: { code: "asc" } }),
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
