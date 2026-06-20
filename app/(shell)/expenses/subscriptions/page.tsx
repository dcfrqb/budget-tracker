export const dynamic = "force-dynamic";

import { getLocale, getT } from "@/lib/i18n/server";
import { getCurrentUserId } from "@/lib/api/auth";
import { getCurrentUserTz } from "@/lib/data/_users/get-user-tz";
import { getSubscriptionsGrouped } from "@/lib/data/subscriptions";
import { getLatestRatesMap } from "@/lib/data/wallet";
import { getSubscriptionSuggestions } from "@/lib/data/_mutations/subscription-pairing";
import { getReimbursementSuggestions } from "@/lib/data/_mutations/reimbursement-pairing";
import {
  toSubscriptionGroupView,
  toSubscriptionsSummaryView,
} from "@/lib/view/subscriptions";
import { SubscriptionsSummaryBar } from "@/components/expenses/subscriptions/summary-bar";
import { SubscriptionGroup } from "@/components/expenses/subscriptions/group";
import { SubscriptionImportButton } from "@/components/expenses/subscriptions/import-button";
import { MatchSuggestions } from "@/components/subscriptions/match-suggestions";
import type { SuggestionRow } from "@/components/subscriptions/match-suggestions";
import { ReimbursementSuggestions } from "@/components/subscriptions/reimbursement-suggestions";
import type { ReimbursementSuggestionRow } from "@/components/subscriptions/reimbursement-suggestions";
import { formatDate } from "@/lib/format/date";

export default async function SubscriptionsPage() {
  const [userId, rates, locale, tz] = await Promise.all([
    getCurrentUserId(),
    getLatestRatesMap(),
    getLocale(),
    getCurrentUserTz(),
  ]);

  const [grouped, rawSuggestions, rawReimbursements] = await Promise.all([
    getSubscriptionsGrouped(userId),
    getSubscriptionSuggestions(userId),
    getReimbursementSuggestions(userId),
  ]);

  const tFn = await getT(locale);

  const summary = toSubscriptionsSummaryView(grouped.totals, tFn);
  const personalGroup = toSubscriptionGroupView("personal", grouped.personal, tFn, rates, locale, tz);
  const splitGroup = toSubscriptionGroupView("split", grouped.split, tFn, rates, locale, tz);
  const paidGroup = toSubscriptionGroupView("paidForOthers", grouped.paidForOthers, tFn, rates, locale, tz);
  const pageTitle = tFn("expenses.subscriptions.pageTitle");

  // Serialize suggestions (convert Dates to formatted strings)
  const suggestions: SuggestionRow[] = rawSuggestions.map((s) => ({
    transactionId: s.transaction.id,
    transactionName: s.transaction.name,
    transactionAmount: s.transaction.amount,
    transactionCurrencyCode: s.transaction.currencyCode,
    transactionDate: formatDate(s.transaction.occurredAt, locale),
    subscriptionId: s.subscription.id,
    subscriptionName: s.subscription.name,
    subscriptionPrice: s.subscription.price,
    subscriptionCurrencyCode: s.subscription.currencyCode,
    reason: s.reason,
  }));

  // Serialize reimbursement suggestions (convert Dates to formatted strings)
  const reimbursementSuggestions: ReimbursementSuggestionRow[] = rawReimbursements.map((r) => ({
    subscriptionId: r.subscription.id,
    subscriptionName: r.subscription.name,
    subscriptionReimbursementFrom: r.subscription.reimbursementFrom,
    incomeId: r.income.id,
    incomeName: r.income.name,
    incomeAmount: r.income.amount,
    incomeCurrencyCode: r.income.currencyCode,
    incomeDate: formatDate(r.income.occurredAt, locale),
    spendId: r.spend?.id ?? null,
    spendAmount: r.spend?.amount ?? null,
    spendCurrencyCode: r.spend?.currencyCode ?? null,
    spendDate: r.spend ? formatDate(r.spend.occurredAt, locale) : null,
    reason: r.reason,
  }));

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

      {suggestions.length > 0 && (
        <MatchSuggestions suggestions={suggestions} />
      )}

      {reimbursementSuggestions.length > 0 && (
        <ReimbursementSuggestions suggestions={reimbursementSuggestions} />
      )}

      <SubscriptionGroup group={personalGroup} tz={tz} />
      <SubscriptionGroup group={splitGroup} tz={tz} />
      <SubscriptionGroup group={paidGroup} tz={tz} />
    </>
  );
}
