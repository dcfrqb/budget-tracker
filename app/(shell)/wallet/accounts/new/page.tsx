import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { AccountForm } from "@/components/forms/account-form";

export const dynamic = "force-dynamic";

export default async function NewAccountPage() {
  const userId = await getCurrentUserId();

  const [institutions, currencies] = await Promise.all([
    db.institution.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
    db.currency.findMany({ orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="page-content">
      <AccountForm
        variant="page"
        mode="create"
        institutions={institutions.map((i) => ({
          id: i.id,
          name: i.name,
          kind: i.kind,
        }))}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
      />
    </div>
  );
}
