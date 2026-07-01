import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { getBusinessById } from "@/lib/data/businesses";
import { db } from "@/lib/db";
import { BusinessForm } from "@/components/forms/business-form";
import { listAllCurrencies } from "@/lib/data/currencies";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditBusinessPage({ params }: Props) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  const [biz, currencies, linkedTxnCount] = await Promise.all([
    getBusinessById(userId, id),
    listAllCurrencies(),
    db.transaction.count({ where: { businessId: id, deletedAt: null } }),
  ]);

  if (!biz) notFound();

  const currencyOptions = currencies.map((c) => ({ code: c.code, symbol: c.symbol }));

  const currencyHasLockedTxns = linkedTxnCount > 0;

  return (
    <div className="page-content">
      <BusinessForm
        variant="page"
        mode="edit"
        businessId={id}
        currencies={currencyOptions}
        currencyHasLockedTxns={currencyHasLockedTxns}
        initialValues={{
          name: biz.name,
          currencyCode: biz.currencyCode,
          startedAt: biz.startedAt ?? undefined,
          isActive: biz.isActive,
          note: biz.note ?? undefined,
        }}
      />
    </div>
  );
}
