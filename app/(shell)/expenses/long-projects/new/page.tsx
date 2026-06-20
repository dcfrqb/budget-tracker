export const dynamic = "force-dynamic";

import { getCurrentUserId } from "@/lib/api/auth";
import { LongProjectForm } from "@/components/forms/long-project-form";
import { listAllCurrencies } from "@/lib/data/currencies";
import { getActiveExpenseCategoriesFull } from "@/lib/data/_shared/category-refs";

export default async function NewLongProjectPage() {
  const userId = await getCurrentUserId();

  const [currencies, categories] = await Promise.all([
    listAllCurrencies(),
    getActiveExpenseCategoriesFull(userId),
  ]);

  return (
    <div className="page-content">
      <LongProjectForm
        variant="page"
        mode="create"
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
      />
    </div>
  );
}
