export const dynamic = "force-dynamic";

import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { LongProjectForm } from "@/components/forms/long-project-form";

export default async function NewLongProjectPage() {
  const userId = await getCurrentUserId();

  const [currencies, categories] = await Promise.all([
    db.currency.findMany({ orderBy: { code: "asc" } }),
    db.category.findMany({
      where: { userId, archivedAt: null, kind: "EXPENSE" },
      orderBy: { name: "asc" },
    }),
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
