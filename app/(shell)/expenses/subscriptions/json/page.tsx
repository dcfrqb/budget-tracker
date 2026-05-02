export const dynamic = "force-dynamic";

import { getCurrentUserId } from "@/lib/api/auth";
import { getSubscriptions } from "@/lib/data/subscriptions";
import { getT } from "@/lib/i18n/server";
import { SubscriptionsJsonEditor } from "@/components/expenses/subscriptions/json-editor";

export default async function SubscriptionsJsonPage() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);
  const allSubs = await getSubscriptions(userId);

  const existingIds = allSubs.map((s) => s.id);
  const initialJson = allSubs.length > 0
    ? JSON.stringify(
        allSubs.map((s) => ({
          id: s.id,
          name: s.name,
          icon: s.icon,
          iconColor: s.iconColor,
          iconBg: s.iconBg,
          price: s.price.toString(),
          currencyCode: s.currencyCode,
          billingIntervalMonths: s.billingIntervalMonths,
          nextPaymentDate: s.nextPaymentDate.toISOString().slice(0, 10),
          sharingType: s.sharingType,
          totalUsers: s.totalUsers,
          familyId: s.familyId,
          isActive: s.isActive,
        })),
        null,
        2,
      )
    : "";

  return (
    <div className="page-content">
      <div className="section">
        <div className="section-hd">
          <div className="ttl mono">
            <b>{t("expenses.subscriptions.json.title")}</b>
          </div>
        </div>
        <div className="section-body">
          <SubscriptionsJsonEditor
            initialJson={initialJson}
            existingIds={existingIds}
          />
        </div>
      </div>
    </div>
  );
}
