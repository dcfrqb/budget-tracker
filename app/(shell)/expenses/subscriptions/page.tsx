export const dynamic = "force-dynamic";

import { getLocale, getT } from "@/lib/i18n/server";
import { getCurrentUserId } from "@/lib/api/auth";
import { getCurrentUserTz } from "@/lib/data/_users/get-user-tz";
import { getSubscriptionsGrouped } from "@/lib/data/subscriptions";
import { getLatestRatesMap } from "@/lib/data/wallet";
import {
  toSubscriptionGroupView,
  toSubscriptionsSummaryView,
} from "@/lib/view/subscriptions";
import { SubscriptionsSummaryBar } from "@/components/expenses/subscriptions/summary-bar";
import { SubscriptionGroup } from "@/components/expenses/subscriptions/group";
import { SubscriptionImportButton } from "@/components/expenses/subscriptions/import-button";

export default async function SubscriptionsPage() {
  const [userId, rates, locale, tz] = await Promise.all([getCurrentUserId(), getLatestRatesMap(), getLocale(), getCurrentUserTz()]);
  const grouped = await getSubscriptionsGrouped(userId);

  const tFn = await getT(locale);

  const summary = toSubscriptionsSummaryView(grouped.totals, tFn);
  const personalGroup = toSubscriptionGroupView("personal", grouped.personal, tFn, rates, locale, tz);
  const splitGroup = toSubscriptionGroupView("split", grouped.split, tFn, rates, locale, tz);
  const paidGroup = toSubscriptionGroupView("paidForOthers", grouped.paidForOthers, tFn, rates, locale, tz);
  const pageTitle = tFn("expenses.subscriptions.pageTitle");

  return (
    <>
      <div className="section fade-in">
        <SubscriptionsSummaryBar
          pageTitle={pageTitle}
          summary={summary}
          addButton={tFn("expenses.subscriptions.summary.addButton")}
          importButton={<SubscriptionImportButton />}
        />
      </div>

      <SubscriptionGroup group={personalGroup} tz={tz} />
      <SubscriptionGroup group={splitGroup} tz={tz} />
      <SubscriptionGroup group={paidGroup} tz={tz} />
    </>
  );
}
