export const dynamic = "force-dynamic";

import { getLocale, getT } from "@/lib/i18n/server";
import { getCurrentUserId } from "@/lib/api/auth";
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
  const [userId, rates, locale] = await Promise.all([getCurrentUserId(), getLatestRatesMap(), getLocale()]);
  const [grouped] = await Promise.all([
    getSubscriptionsGrouped(userId),
  ]);

  const tFn = await getT(locale);

  const summary = toSubscriptionsSummaryView(grouped.totals, tFn);
  const personalGroup = toSubscriptionGroupView("personal", grouped.personal, tFn, rates, locale);
  const splitGroup = toSubscriptionGroupView("split", grouped.split, tFn, rates, locale);
  const paidGroup = toSubscriptionGroupView("paidForOthers", grouped.paidForOthers, tFn, rates, locale);
  const markPaidLabel = tFn("expenses.subscriptions.card.markPaid");
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

      <SubscriptionGroup group={personalGroup} markPaidLabel={markPaidLabel} />
      <SubscriptionGroup group={splitGroup} markPaidLabel={markPaidLabel} />
      <SubscriptionGroup group={paidGroup} markPaidLabel={markPaidLabel} />
    </>
  );
}
