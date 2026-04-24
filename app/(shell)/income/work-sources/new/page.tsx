import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { WorkSourceForm } from "@/components/forms/work-source-form";

export const dynamic = "force-dynamic";

export default async function NewWorkSourcePage() {
  const userId = await getCurrentUserId();

  const currencies = await db.currency.findMany({ orderBy: { code: "asc" } });

  return (
    <div className="page-content">
      <WorkSourceForm
        variant="page"
        mode="create"
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
      />
    </div>
  );
}
