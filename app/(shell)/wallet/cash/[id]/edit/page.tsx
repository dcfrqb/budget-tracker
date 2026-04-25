import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { AccountKind } from "@prisma/client";
import { CashEditForm } from "@/components/wallet/cash-edit-form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCashPage({ params }: Props) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  const [account, currencies] = await Promise.all([
    db.account.findFirst({
      where: { id, userId, kind: AccountKind.CASH, deletedAt: null },
      select: {
        id: true,
        location: true,
        currencyCode: true,
        balance: true,
        includeInAnalytics: true,
      },
    }),
    db.currency.findMany({ orderBy: { code: "asc" } }),
  ]);

  if (!account) notFound();

  return (
    <div className="page-content">
      <CashEditForm
        id={id}
        initialLocation={account.location ?? ""}
        initialCurrency={account.currencyCode}
        initialBalance={account.balance.toString()}
        initialIncludeInAnalytics={account.includeInAnalytics}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
      />
    </div>
  );
}
