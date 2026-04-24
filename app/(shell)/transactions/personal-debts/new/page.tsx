export const dynamic = "force-dynamic";

import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { PersonalDebtForm } from "@/components/forms/personal-debt-form";

export default async function NewPersonalDebtPage() {
  const userId = await getCurrentUserId();

  const [currencies, accounts] = await Promise.all([
    db.currency.findMany({ orderBy: { code: "asc" } }),
    db.account.findMany({
      where: { userId, isArchived: false, deletedAt: null },
      orderBy: { name: "asc" },
      include: { currency: true },
    }),
  ]);

  return (
    <div className="page-content">
      <PersonalDebtForm
        variant="page"
        mode="create"
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          currencyCode: a.currencyCode,
        }))}
      />
    </div>
  );
}
