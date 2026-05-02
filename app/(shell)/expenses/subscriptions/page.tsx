export const dynamic = "force-dynamic";

import { getLocale, getT } from "@/lib/i18n/server";
import { getCurrentUserId } from "@/lib/api/auth";
import { getSubscriptionsGrouped, getSubscriptions } from "@/lib/data/subscriptions";
import { getLatestRatesMap } from "@/lib/data/wallet";
import {
  toSubscriptionGroupView,
  toSubscriptionsSummaryView,
} from "@/lib/view/subscriptions";
import { SubscriptionsSummaryBar } from "@/components/expenses/subscriptions/summary-bar";
import { SubscriptionGroup } from "@/components/expenses/subscriptions/group";
import { SubscriptionImportButton } from "@/components/expenses/subscriptions/import-button";

export default async function SubscriptionsPage() {
  const [userId, rates, locale] = await Promise.all([getCurrentUserId(), getLatestRatesMap(), getLocale()]);
  const [grouped, allSubs] = await Promise.all([
    getSubscriptionsGrouped(userId),
    getSubscriptions(userId),
  ]);

  const tFn = await getT(locale);

  const summary = toSubscriptionsSummaryView(grouped.totals, tFn);
  const personalGroup = toSubscriptionGroupView("personal", grouped.personal, tFn, rates, locale);
  const splitGroup = toSubscriptionGroupView("split", grouped.split, tFn, rates, locale);
  const paidGroup = toSubscriptionGroupView("paidForOthers", grouped.paidForOthers, tFn, rates, locale);
  const pageTitle = tFn("expenses.subscriptions.pageTitle");

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
    <>
      <div className="section fade-in">
        <SubscriptionsSummaryBar
          pageTitle={pageTitle}
          summary={summary}
          addButton={tFn("expenses.subscriptions.summary.addButton")}
          importButton={
            <SubscriptionImportButton
              initialJson={initialJson}
              existingIds={existingIds}
            />
          }
        />
      </div>

      <SubscriptionGroup group={personalGroup} />
      <SubscriptionGroup group={splitGroup} />
      <SubscriptionGroup group={paidGroup} />
    </>
  );
}
