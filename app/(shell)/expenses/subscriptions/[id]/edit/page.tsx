export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { SubscriptionForm } from "@/components/forms/subscription-form";
import { SharesEditor } from "@/components/subscriptions/shares-editor";
import type { ShareItem } from "@/components/subscriptions/shares-editor";
import { getT } from "@/lib/i18n/server";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditSubscriptionPage({ params }: Props) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const t = await getT();

  const [sub, currencies] = await Promise.all([
    db.subscription.findFirst({
      where: { id, userId, deletedAt: null },
      include: { shares: true },
    }),
    db.currency.findMany({ orderBy: { code: "asc" } }),
  ]);

  if (!sub) notFound();

  const initialShares: ShareItem[] = sub.shares.map((s) => ({
    id: s.id,
    person: s.person,
    amount: s.amount != null ? String(s.amount) : null,
  }));

  const isSplit = sub.sharingType === "SPLIT" || sub.sharingType === "PAID_FOR_OTHERS";

  return (
    <div className="page-content">
      <SubscriptionForm
        variant="page"
        mode="edit"
        subscriptionId={id}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        initialValues={{
          name: sub.name,
          icon: sub.icon ?? undefined,
          iconColor: sub.iconColor ?? undefined,
          iconBg: sub.iconBg ?? undefined,
          price: String(sub.price),
          currencyCode: sub.currencyCode,
          billingIntervalMonths: sub.billingIntervalMonths,
          nextPaymentDate: sub.nextPaymentDate.toISOString().slice(0, 10),
          sharingType: sub.sharingType,
          totalUsers: sub.totalUsers ?? undefined,
          isActive: sub.isActive,
        }}
      />

      {isSplit && (
        <div className="section" style={{ marginTop: "var(--space-6)" }}>
          <div className="section-hd">
            <div className="ttl mono">
              <b>{t("forms.sub.shares_editor.title")}</b>
            </div>
          </div>
          <div className="section-body">
            <SharesEditor
              subscriptionId={id}
              initialShares={initialShares}
              isSplit={isSplit}
            />
          </div>
        </div>
      )}
    </div>
  );
}
