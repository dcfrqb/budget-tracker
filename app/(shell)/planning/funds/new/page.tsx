export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { FundForm } from "@/components/forms/fund-form";

export default async function NewFundPage() {
  const currencies = await db.currency.findMany({ orderBy: { code: "asc" } });

  return (
    <div className="page-content">
      <FundForm
        variant="page"
        mode="create"
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
      />
    </div>
  );
}
