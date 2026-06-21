/**
 * integration/subscription-pairing.test.ts
 *
 * Integration tests for lib/data/_mutations/subscription-pairing.ts
 * → autoMatchSubscriptions
 *
 * Key constants from the module (verified at source):
 *   DEFAULT_LOOKBACK_DAYS      = 90
 *   DATE_WINDOW_DAYS           = 5   (monthly/quarterly/semi-annual)
 *   DATE_WINDOW_DAYS_ANNUAL    = 12  (billingIntervalMonths >= 12)
 *   AMOUNT_TOLERANCE           = 0.05 (5%)
 *   CROSS_CCY_FX_TOLERANCE     = 0.10 (10%)
 *   SUGGESTION_SIMILARITY_THRESHOLD = 0.6
 *
 * autoMatch=true is required on the subscription for auto-linking.
 * matchKeywords: normalized alias strings used by findMatchingSubsByAlias.
 * isVariablePrice: if true, all matching charges link (no period dedup), price check skipped.
 * Fixed subs: period dedup — only earliest txn per expected period links.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Prisma, TransactionKind } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { makeAccount, makeTransaction } from "@/tests/fixtures/builders";
import { autoMatchSubscriptions } from "@/lib/data/_mutations/subscription-pairing";

// Fixed "now" for all date windows
const NOW = new Date("2024-06-15T12:00:00.000Z");

function daysFromNow(n: number): Date {
  return new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
}

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

// Helper: create a subscription with autoMatch=true and a matchKeyword
async function makeAutoMatchSub(opts: {
  name: string;
  price: string;
  billingIntervalMonths?: number;
  nextPaymentDate: Date;
  matchKeyword: string;
  isVariablePrice?: boolean;
  currencyCode?: string;
}) {
  return db.subscription.create({
    data: {
      userId: DEFAULT_USER_ID,
      name: opts.name,
      price: new Prisma.Decimal(opts.price),
      currencyCode: opts.currencyCode ?? "RUB",
      billingIntervalMonths: opts.billingIntervalMonths ?? 1,
      nextPaymentDate: opts.nextPaymentDate,
      isActive: true,
      autoMatch: true,
      sharingType: "PERSONAL",
      isVariablePrice: opts.isVariablePrice ?? false,
      matchKeywords: [opts.matchKeyword],
    },
  });
}

describe("autoMatchSubscriptions – alias matching and date/amount gates", () => {
  let accId: string;

  beforeEach(async () => {
    const acc = await makeAccount(db, { name: "Main", currencyCode: "RUB" });
    accId = acc.id;
  });

  it("auto-links a charge that matches by alias, within date window, within amount tolerance", async () => {
    // nextPaymentDate is in the future; a charge occurred within ±5 days of expected date
    const sub = await makeAutoMatchSub({
      name: "Netflix",
      price: "799",
      billingIntervalMonths: 1,
      nextPaymentDate: daysFromNow(2), // expected in 2 days
      matchKeyword: "netflix",
    });

    const txn = await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "799",
      currencyCode: "RUB",
      occurredAt: daysAgo(1), // 1 day ago — within ±5 day window of nextPaymentDate
      name: "Netflix Premium",
    });

    const result = await autoMatchSubscriptions({
      userId: DEFAULT_USER_ID,
      windowFrom: daysAgo(90),
      windowTo: NOW,
    });

    expect(result.autoLinked).toBe(1);
    expect(result.ambiguousSkipped).toBe(0);

    const txnUpdated = await db.transaction.findUnique({
      where: { id: txn.id },
      select: { subscriptionId: true, subscriptionLinkSource: true },
    });
    expect(txnUpdated?.subscriptionId).toBe(sub.id);
    expect(txnUpdated?.subscriptionLinkSource).toBe("auto");
  });

  it("does NOT auto-link when amount exceeds 5% tolerance", async () => {
    await makeAutoMatchSub({
      name: "Spotify",
      price: "500",
      nextPaymentDate: daysFromNow(1),
      matchKeyword: "spotify",
    });

    const txn = await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "600",  // 20% over — exceeds 5% tolerance
      currencyCode: "RUB",
      occurredAt: daysAgo(1),
      name: "Spotify Music",
    });

    const result = await autoMatchSubscriptions({
      userId: DEFAULT_USER_ID,
      windowFrom: daysAgo(90),
      windowTo: NOW,
    });

    expect(result.autoLinked).toBe(0);

    const txnCheck = await db.transaction.findUnique({ where: { id: txn.id }, select: { subscriptionId: true } });
    expect(txnCheck?.subscriptionId).toBeNull();
  });

  it("skips (ambiguousSkipped) when multiple subscriptions match the same alias", async () => {
    // Two subs with overlapping alias "yandex"
    await makeAutoMatchSub({
      name: "Yandex Plus",
      price: "299",
      nextPaymentDate: daysFromNow(2),
      matchKeyword: "yandex",
    });
    await makeAutoMatchSub({
      name: "Yandex Music",
      price: "299",
      nextPaymentDate: daysFromNow(2),
      matchKeyword: "yandex",
    });

    await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "299",
      currencyCode: "RUB",
      occurredAt: daysAgo(1),
      name: "Yandex подписка",
    });

    const result = await autoMatchSubscriptions({
      userId: DEFAULT_USER_ID,
      windowFrom: daysAgo(90),
      windowTo: NOW,
    });

    expect(result.ambiguousSkipped).toBeGreaterThan(0);
    expect(result.autoLinked).toBe(0);
  });
});

describe("autoMatchSubscriptions – variable-price subscription", () => {
  let accId: string;

  beforeEach(async () => {
    const acc = await makeAccount(db, { name: "Main", currencyCode: "RUB" });
    accId = acc.id;
  });

  it("links ALL matching charges for a variable-price subscription (no period dedup)", async () => {
    // Variable price: amount check is skipped, all matching charges link
    const sub = await makeAutoMatchSub({
      name: "Mobile Plan",
      price: "500",  // placeholder — ignored for variable price
      nextPaymentDate: daysFromNow(5),
      matchKeyword: "mobileplan",
      isVariablePrice: true,
    });

    // Three charges with different amounts (variable price — all should link)
    const t1 = await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "400",
      currencyCode: "RUB",
      occurredAt: daysAgo(45),
      name: "MobilePlan charge",
    });
    const t2 = await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "550",
      currencyCode: "RUB",
      occurredAt: daysAgo(15),
      name: "MobilePlan charge",
    });
    const t3 = await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "600",
      currencyCode: "RUB",
      occurredAt: daysAgo(2),
      name: "MobilePlan charge",
    });

    const result = await autoMatchSubscriptions({
      userId: DEFAULT_USER_ID,
      windowFrom: daysAgo(90),
      windowTo: NOW,
    });

    expect(result.autoLinked).toBe(3);

    const [r1, r2, r3] = await Promise.all([
      db.transaction.findUnique({ where: { id: t1.id }, select: { subscriptionId: true } }),
      db.transaction.findUnique({ where: { id: t2.id }, select: { subscriptionId: true } }),
      db.transaction.findUnique({ where: { id: t3.id }, select: { subscriptionId: true } }),
    ]);
    expect(r1?.subscriptionId).toBe(sub.id);
    expect(r2?.subscriptionId).toBe(sub.id);
    expect(r3?.subscriptionId).toBe(sub.id);
  });
});

describe("autoMatchSubscriptions – advance-once invariant", () => {
  let accId: string;

  beforeEach(async () => {
    const acc = await makeAccount(db, { name: "Main", currencyCode: "RUB" });
    accId = acc.id;
  });

  it("advances nextPaymentDate exactly once after a successful match", async () => {
    // nextPaymentDate is in the PAST (already passed); a charge happened after nextPaymentDate.
    // advanceNextPaymentDate: if currentNext <= paidAt, advance by intervals until > paidAt.
    // Setup: nextPaymentDate = daysAgo(5); charge = daysAgo(3)
    // → daysAgo(5) <= daysAgo(3) → advance by 1 month → newNext ≈ daysFromNow(25) > sub.nextPaymentDate
    const sub = await makeAutoMatchSub({
      name: "iCloud",
      price: "299",
      billingIntervalMonths: 1,
      nextPaymentDate: daysAgo(5),  // past nextPaymentDate
      matchKeyword: "icloud",
    });

    const originalNext = sub.nextPaymentDate;

    await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "299",
      currencyCode: "RUB",
      occurredAt: daysAgo(3),  // charge occurred after nextPaymentDate
      name: "iCloud Storage",
    });

    const result = await autoMatchSubscriptions({
      userId: DEFAULT_USER_ID,
      windowFrom: daysAgo(90),
      windowTo: NOW,
    });

    expect(result.autoLinked).toBe(1);
    expect(result.advanced).toBe(1);

    const subUpdated = await db.subscription.findUnique({
      where: { id: sub.id },
      select: { nextPaymentDate: true },
    });

    // nextPaymentDate should have advanced past the charge date
    expect(subUpdated!.nextPaymentDate > originalNext).toBe(true);
    // Should be strictly after the charge occurred (daysAgo(3))
    expect(subUpdated!.nextPaymentDate > daysAgo(3)).toBe(true);
  });
});

describe("autoMatchSubscriptions – IDEMPOTENCY (critical)", () => {
  let accId: string;

  beforeEach(async () => {
    const acc = await makeAccount(db, { name: "Main", currencyCode: "RUB" });
    accId = acc.id;
  });

  it("running reconcile TWICE does not create duplicate links or advance period twice", async () => {
    // nextPaymentDate in the past so a charge can trigger an advance
    const sub = await makeAutoMatchSub({
      name: "Dropbox",
      price: "299",
      billingIntervalMonths: 1,
      nextPaymentDate: daysAgo(7),  // past, so charge at daysAgo(5) triggers advance
      matchKeyword: "dropbox",
    });

    const originalNext = sub.nextPaymentDate;

    await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "299",
      currencyCode: "RUB",
      occurredAt: daysAgo(5),  // after nextPaymentDate → triggers advance
      name: "Dropbox Business",
    });

    const opts = {
      userId: DEFAULT_USER_ID,
      windowFrom: daysAgo(90),
      windowTo: NOW,
    };

    // First run
    const result1 = await autoMatchSubscriptions(opts);
    expect(result1.autoLinked).toBe(1);
    expect(result1.advanced).toBe(1);

    const subAfterRun1 = await db.subscription.findUnique({
      where: { id: sub.id },
      select: { nextPaymentDate: true },
    });
    const nextAfterRun1 = subAfterRun1!.nextPaymentDate;
    expect(nextAfterRun1 > originalNext).toBe(true);

    // Second run — same data
    const result2 = await autoMatchSubscriptions(opts);
    // Transaction already has subscriptionId set → not a candidate (subscriptionId: null filter)
    expect(result2.autoLinked).toBe(0);
    expect(result2.advanced).toBe(0);

    const subAfterRun2 = await db.subscription.findUnique({
      where: { id: sub.id },
      select: { nextPaymentDate: true },
    });
    // nextPaymentDate should NOT have advanced a second time
    expect(subAfterRun2!.nextPaymentDate.getTime()).toBe(nextAfterRun1.getTime());
  });

  it("second run does not re-advance a variable-price subscription that already matched", async () => {
    // nextPaymentDate must be in the past for the deferred advance to trigger
    const sub = await makeAutoMatchSub({
      name: "Variable Sub",
      price: "100",
      billingIntervalMonths: 1,
      nextPaymentDate: daysAgo(10),  // in the past → charge at daysAgo(5) triggers advance
      matchKeyword: "variablesub",
      isVariablePrice: true,
    });

    const originalNext = sub.nextPaymentDate;

    await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "150",
      currencyCode: "RUB",
      occurredAt: daysAgo(5),  // after nextPaymentDate → deferred advance
      name: "VariableSub charge",
    });

    const opts = {
      userId: DEFAULT_USER_ID,
      windowFrom: daysAgo(90),
      windowTo: NOW,
    };

    await autoMatchSubscriptions(opts);
    const subAfterRun1 = await db.subscription.findUnique({
      where: { id: sub.id },
      select: { nextPaymentDate: true },
    });
    const nextAfterRun1 = subAfterRun1!.nextPaymentDate;
    expect(nextAfterRun1 > originalNext).toBe(true);

    // Second run
    await autoMatchSubscriptions(opts);
    const subAfterRun2 = await db.subscription.findUnique({
      where: { id: sub.id },
      select: { nextPaymentDate: true },
    });
    // Should be the same — not advanced again
    expect(subAfterRun2!.nextPaymentDate.getTime()).toBe(nextAfterRun1.getTime());
  });
});

describe("autoMatchSubscriptions – STICKY manual links (critical)", () => {
  let accId: string;

  beforeEach(async () => {
    const acc = await makeAccount(db, { name: "Main", currencyCode: "RUB" });
    accId = acc.id;
  });

  it("does NOT overwrite a manual link on re-sync", async () => {
    // Single subscription — no ambiguity. The only reason the already-linked
    // transaction must NOT be touched is the `subscriptionId: null` filter in
    // the candidate query (autoMatchSubscriptions only considers unlinked txns).
    // If that filter were removed, the matcher would find the txn as a candidate
    // and overwrite the manual link with an auto link.
    const subA = await makeAutoMatchSub({
      name: "Netflix",
      price: "799",
      nextPaymentDate: daysFromNow(2),
      matchKeyword: "netflix",
    });

    // Create the transaction already manually linked to subA
    const txn = await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "799",
      currencyCode: "RUB",
      occurredAt: daysAgo(1),
      name: "Netflix",
    });

    // Simulate a manual link (as if user linked it by hand in the UI)
    await db.transaction.update({
      where: { id: txn.id },
      data: {
        subscriptionId: subA.id,
        subscriptionLinkSource: "manual",
      },
    });

    // Run auto-matcher — must NOT touch the already-linked transaction
    await autoMatchSubscriptions({
      userId: DEFAULT_USER_ID,
      windowFrom: daysAgo(90),
      windowTo: NOW,
    });

    // Manual link and link-source must be exactly preserved
    const txnCheck = await db.transaction.findUnique({
      where: { id: txn.id },
      select: { subscriptionId: true, subscriptionLinkSource: true },
    });
    expect(txnCheck?.subscriptionId).toBe(subA.id);
    expect(txnCheck?.subscriptionLinkSource).toBe("manual");
  });

  it("does NOT overwrite a transaction marked as 'unlinked'", async () => {
    await makeAutoMatchSub({
      name: "Steam",
      price: "999",
      nextPaymentDate: daysFromNow(3),
      matchKeyword: "steam",
    });

    const txn = await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "999",
      currencyCode: "RUB",
      occurredAt: daysAgo(2),
      name: "Steam Purchase",
    });

    // Mark as explicitly unlinked (user said "this is not a subscription")
    await db.transaction.update({
      where: { id: txn.id },
      data: { subscriptionLinkSource: "unlinked" },
    });

    await autoMatchSubscriptions({
      userId: DEFAULT_USER_ID,
      windowFrom: daysAgo(90),
      windowTo: NOW,
    });

    const txnCheck = await db.transaction.findUnique({
      where: { id: txn.id },
      select: { subscriptionId: true, subscriptionLinkSource: true },
    });
    // Should remain unlinked
    expect(txnCheck?.subscriptionId).toBeNull();
    expect(txnCheck?.subscriptionLinkSource).toBe("unlinked");
  });
});
