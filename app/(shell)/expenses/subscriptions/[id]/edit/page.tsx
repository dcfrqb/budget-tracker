export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getCurrentUserId } from "@/lib/api/auth";
import { getCurrentUserTz } from "@/lib/data/_users/get-user-tz";
import { dayKeyInTz, formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { getSubscriptionCharges } from "@/lib/data/subscriptions";
import { estimateRecurringAmount } from "@/lib/subscription-share";
import { SubscriptionForm } from "@/components/forms/subscription-form";
import { SharesEditor } from "@/components/subscriptions/shares-editor";
import type { ShareItem } from "@/components/subscriptions/shares-editor";
import { PaymentHistory } from "@/components/subscriptions/payment-history";
import type { ChargeRow } from "@/components/subscriptions/payment-history";
import { getT, getLocale } from "@/lib/i18n/server";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditSubscriptionPage({ params }: Props) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const [t, tz, locale] = await Promise.all([getT(), getCurrentUserTz(), getLocale()]);

  const [sub, currencies, rawCharges] = await Promise.all([
    db.subscription.findFirst({
      where: { id, userId, deletedAt: null },
      include: { shares: true },
    }),
    db.currency.findMany({ orderBy: { code: "asc" } }),
    getSubscriptionCharges(userId, id),
  ]);

  if (!sub) notFound();

  const initialShares: ShareItem[] = sub.shares.map((s) => ({
    id: s.id,
    person: s.person,
    amount: s.amount != null ? String(s.amount) : null,
  }));

  const isSplit = sub.sharingType === "SPLIT" || sub.sharingType === "PAID_FOR_OTHERS";

  // Compute effective monthly for variance display (uses rolling average for variable-price subs)
  const effectiveMonthly = estimateRecurringAmount({
    price: new Prisma.Decimal(sub.price),
    isVariablePrice: sub.isVariablePrice ?? false,
    recentCharges: rawCharges.map((c) => ({
      amount: new Prisma.Decimal(c.amount),
      currencyCode: c.currencyCode,
    })),
    currency: sub.currencyCode,
  });

  const charges: ChargeRow[] = rawCharges.map((c) => {
    let varianceLabel: string | null = null;
    if (sub.isVariablePrice && rawCharges.length > 0) {
      const chargeAmt = new Prisma.Decimal(c.amount);
      const eff = effectiveMonthly;
      if (!eff.isZero()) {
        const pct = chargeAmt.minus(eff).div(eff).times(100).toFixed(0);
        const pctNum = Number(pct);
        if (Math.abs(pctNum) >= 2) {
          varianceLabel = pctNum >= 0 ? `+${pctNum}%` : `${pctNum}%`;
        }
      }
    }
    return {
      id: c.id,
      occurredAtFormatted: formatDate(c.occurredAt, locale),
      amount: formatMoney(c.amount, c.currencyCode),
      currencyCode: c.currencyCode,
      accountName: c.accountName,
      subscriptionLinkSource: c.subscriptionLinkSource,
      varianceLabel,
    };
  });

  return (
    <div className="page-content">
      <SubscriptionForm
        variant="page"
        mode="edit"
        subscriptionId={id}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        tz={tz}
        matchKeywords={sub.matchKeywords}
        initialValues={{
          name: sub.name,
          icon: sub.icon ?? undefined,
          iconColor: sub.iconColor ?? undefined,
          iconBg: sub.iconBg ?? undefined,
          price: String(sub.price),
          currencyCode: sub.currencyCode,
          billingIntervalMonths: sub.billingIntervalMonths,
          nextPaymentDate: dayKeyInTz(sub.nextPaymentDate, tz),
          sharingType: sub.sharingType,
          totalUsers: sub.totalUsers ?? undefined,
          isActive: sub.isActive,
          isVariablePrice: sub.isVariablePrice ?? false,
          autoMatch: sub.autoMatch ?? true,
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

      {/* Payment history */}
      <div className="section" style={{ marginTop: "var(--space-6)" }}>
        <div className="section-hd">
          <div className="ttl mono">
            <b>{t("expenses.subscriptions.history.title")}</b>
          </div>
        </div>
        <div className="section-body">
          <PaymentHistory charges={charges} />
        </div>
      </div>
    </div>
  );
}
