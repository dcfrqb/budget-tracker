import { listAllCurrencies } from "@/lib/data/currencies";
import { FundForm } from "@/components/forms/fund-form";

export const dynamic = "force-dynamic";

export default async function NewFundPage() {
  const currencies = await listAllCurrencies();

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
