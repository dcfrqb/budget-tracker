export const dynamic = "force-dynamic";

import React from "react";
import { getLocale, getT } from "@/lib/i18n/server";
import { getCurrentUserId } from "@/lib/api/auth";
import { getCurrentUserTz } from "@/lib/data/_users/get-user-tz";
import { getSubscriptionsGrouped, getDuplicateSuggestions, getSubscriptionCharges } from "@/lib/data/subscriptions";
import { getLatestRatesMap } from "@/lib/data/wallet";
import { getSubscriptionSuggestions } from "@/lib/data/_mutations/subscription-pairing";
import { getReimbursementSuggestions } from "@/lib/data/_mutations/reimbursement-pairing";
import {
  toSubscriptionGroupView,
  toSubscriptionsSummaryView,
} from "@/lib/view/subscriptions";
import { SubscriptionsSummaryBar } from "@/components/expenses/subscriptions/summary-bar";
import { SubscriptionsShell } from "@/components/expenses/subscriptions/subscriptions-shell";
import { SubscriptionImportButton } from "@/components/expenses/subscriptions/import-button";
import { MatchSuggestions } from "@/components/subscriptions/match-suggestions";
import type { SuggestionRow } from "@/components/subscriptions/match-suggestions";
import { ReimbursementSuggestions } from "@/components/subscriptions/reimbursement-suggestions";
import type { ReimbursementSuggestionRow } from "@/components/subscriptions/reimbursement-suggestions";
import { DuplicateSuggestions } from "@/components/expenses/subscriptions/duplicate-suggestions";
import type { DuplicatePairRow } from "@/components/expenses/subscriptions/duplicate-suggestions";
import type { MergeSubItem } from "@/components/expenses/subscriptions/merge-dialog";
import { formatDate, dayKeyInTz } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { listAllCurrencies } from "@/lib/data/currencies";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { estimateRecurringAmount } from "@/lib/subscription-share";
import { SubscriptionSheetHost } from "@/components/expenses/subscriptions/subscription-sheet-host";
import type { ShareItem } from "@/components/subscriptions/shares-editor";
import type { ChargeRow } from "@/components/subscriptions/payment-history";

interface PageProps {
  searchParams: Promise<{ new?: string; edit?: string }>;
}

export default async function SubscriptionsPage({ searchParams }: PageProps) {
  const [userId, rates, locale, tz, params] = await Promise.all([
    getCurrentUserId(),
    getLatestRatesMap(),
    getLocale(),
    getCurrentUserTz(),
    searchParams,
  ]);

  const [grouped, rawSuggestions, rawReimbursements, duplicatePairs] = await Promise.all([
    getSubscriptionsGrouped(userId),
    getSubscriptionSuggestions(userId),
    getReimbursementSuggestions(userId),
    getDuplicateSuggestions(userId),
  ]);

  const tFn = await getT(locale);

  const summary = toSubscriptionsSummaryView(grouped.totals, tFn);
  const personalGroup = toSubscriptionGroupView("personal", grouped.personal, tFn, rates, locale, tz);
  const splitGroup = toSubscriptionGroupView("split", grouped.split, tFn, rates, locale, tz);
  const paidGroup = toSubscriptionGroupView("paidForOthers", grouped.paidForOthers, tFn, rates, locale, tz);
  const pageTitle = tFn("expenses.subscriptions.pageTitle");

  // Build sub meta list for selection bar (id, name, raw price, currency)
  const allSubs = [...grouped.personal, ...grouped.split, ...grouped.paidForOthers];
  const subMetas: MergeSubItem[] = allSubs.map((s) => ({
    id: s.id,
    name: s.name,
    price: String(s.price),
    currencyCode: s.currencyCode,
  }));

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
    count: s.count,
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

  // Serialize duplicate pairs
  const serializedDuplicates: DuplicatePairRow[] = duplicatePairs.map((p) => ({
    a: { id: p.a.id, name: p.a.name, price: p.a.price, currencyCode: p.a.currencyCode },
    b: { id: p.b.id, name: p.b.name, price: p.b.price, currencyCode: p.b.currencyCode },
  }));

  // ── Sheet: lazy-fetch only when ?new=sub or ?edit=sub:<id> ─────────────────
  const isSubCreate = params.new === "sub";
  const isSubEdit =
    typeof params.edit === "string" && params.edit.startsWith("sub:");
  const editSubId = isSubEdit ? (params.edit as string).slice("sub:".length) : null;

  let sheetNode: React.ReactNode = null;

  if (isSubCreate || isSubEdit) {
    const [sheetCurrencies, editSub, editCharges] = await Promise.all([
      listAllCurrencies(),
      editSubId
        ? db.subscription.findFirst({
            where: { id: editSubId, userId, deletedAt: null },
            include: { shares: true },
          })
        : Promise.resolve(null),
      editSubId
        ? getSubscriptionCharges(userId, editSubId)
        : Promise.resolve([]),
    ]);

    let sheetInitialValues: Record<string, unknown> | undefined;
    let sheetInitialShares: ShareItem[] | undefined;
    let sheetCharges: ChargeRow[] | undefined;
    let sheetIsSplit = false;
    let sheetMatchKeywords: string[] | undefined;

    if (editSub) {
      sheetInitialValues = {
        name: editSub.name,
        icon: editSub.icon ?? undefined,
        iconColor: editSub.iconColor ?? undefined,
        iconBg: editSub.iconBg ?? undefined,
        price: String(editSub.price),
        currencyCode: editSub.currencyCode,
        billingIntervalMonths: editSub.billingIntervalMonths,
        nextPaymentDate: dayKeyInTz(editSub.nextPaymentDate, tz),
        sharingType: editSub.sharingType,
        totalUsers: editSub.totalUsers ?? undefined,
        isActive: editSub.isActive,
        isVariablePrice: editSub.isVariablePrice ?? false,
        autoMatch: editSub.autoMatch ?? true,
      };

      sheetInitialShares = editSub.shares.map((s) => ({
        id: s.id,
        person: s.person,
        amount: s.amount != null ? String(s.amount) : null,
      }));

      sheetIsSplit =
        editSub.sharingType === "SPLIT" ||
        editSub.sharingType === "PAID_FOR_OTHERS";

      sheetMatchKeywords = editSub.matchKeywords;

      const effectiveMonthly = estimateRecurringAmount({
        price: new Prisma.Decimal(editSub.price),
        isVariablePrice: editSub.isVariablePrice ?? false,
        recentCharges: editCharges.map((c) => ({
          amount: new Prisma.Decimal(c.amount),
          currencyCode: c.currencyCode,
        })),
        currency: editSub.currencyCode,
      });

      sheetCharges = editCharges.map((c) => {
        let varianceLabel: string | null = null;
        if (editSub.isVariablePrice && editCharges.length > 0) {
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
    }

    sheetNode = (
      <SubscriptionSheetHost
        currencies={sheetCurrencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        tz={tz}
        subscriptionId={editSubId ?? undefined}
        initialValues={sheetInitialValues}
        initialShares={sheetInitialShares}
        charges={sheetCharges}
        isSplit={sheetIsSplit}
        matchKeywords={sheetMatchKeywords}
      />
    );
  }

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

      {serializedDuplicates.length > 0 && (
        <DuplicateSuggestions pairs={serializedDuplicates} />
      )}

      <SubscriptionsShell
        personalGroup={personalGroup}
        splitGroup={splitGroup}
        paidGroup={paidGroup}
        subMetas={subMetas}
        tz={tz}
      />

      {sheetNode}
    </>
  );
}
