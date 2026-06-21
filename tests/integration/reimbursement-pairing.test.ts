/**
 * integration/reimbursement-pairing.test.ts
 *
 * Integration tests for lib/data/_mutations/reimbursement-pairing.ts
 * → autoMatchReimbursements
 *
 * Key constants from the module (verified at source):
 *   LOOKBACK_DAYS       = 60   (getReimbursementSuggestions only)
 *   DEFAULT_LOOKBACK_DAYS = 90 (autoMatchReimbursements)
 *   SUGGEST_TOLERANCE   = 0.05 (5%)
 *   AUTO_TOLERANCE      = 0.02 (2%)  ← tight gate for auto-link
 *   WINDOW_BEFORE_DAYS  = 3   (income may arrive up to 3 days before the spend)
 *   WINDOW_AFTER_DAYS   = 30  (income may arrive up to 30 days after the spend)
 *
 * autoMatchReimbursements only considers:
 *   - Subscriptions: isActive=true, deletedAt=null, sharingType=PAID_FOR_OTHERS, reimbursementFrom!=null
 *   - Incomes: kind=INCOME, transferId=null, compensationGroupId=null, name ILIKE nameToken
 *   - Spends: kind=EXPENSE, subscriptionId = sub.id, compensationGroupId=null
 *   - Amount gate: |income - spend| / |spend| <= 2%
 *   - Ambiguous: if >1 income matches a spend → skip (ambiguousSkipped++)
 *
 * "Захар bundle" negative case:
 *   Guard: AUTO_TOLERANCE = 2%. A bundled payment (e.g. "Захар" sends one payment
 *   covering TWO subscription shares combined) will have amount ≠ the individual
 *   spend ± 2% → blocked solely by the amount gate (ambiguousSkipped === 0 because
 *   the income-pool query for each spend returns one income that fails the gate,
 *   not two — so matching.length is 0, not >1).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Prisma, TransactionKind, SharingType } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { makeAccount, makeTransaction } from "@/tests/fixtures/builders";
import { autoMatchReimbursements } from "@/lib/data/_mutations/reimbursement-pairing";

// Fixed reference "now"
const NOW = new Date("2024-06-15T12:00:00.000Z");

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

function daysFromNow(n: number): Date {
  return new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
}

// Create a PAID_FOR_OTHERS subscription with reimbursementFrom
async function makePaidForOthersSub(opts: {
  name: string;
  price: string;
  reimbursementFrom: string;
  currencyCode?: string;
}) {
  return db.subscription.create({
    data: {
      userId: DEFAULT_USER_ID,
      name: opts.name,
      price: new Prisma.Decimal(opts.price),
      currencyCode: opts.currencyCode ?? "RUB",
      billingIntervalMonths: 1,
      nextPaymentDate: daysFromNow(10),
      isActive: true,
      autoMatch: false, // autoMatch is for subscription auto-link, not reimbursement
      sharingType: SharingType.PAID_FOR_OTHERS,
      reimbursementFrom: opts.reimbursementFrom,
    },
  });
}

describe("autoMatchReimbursements – basic auto-link", () => {
  let accId: string;
  let incomeAccId: string;

  beforeEach(async () => {
    const acc = await makeAccount(db, { name: "Checking", currencyCode: "RUB" });
    const incAcc = await makeAccount(db, { name: "Income Account", currencyCode: "RUB" });
    accId = acc.id;
    incomeAccId = incAcc.id;
  });

  it("auto-links income matching by name token + 2% amount gate within 30-day window", async () => {
    // "Алексей" pays back for Netflix — reimbursementFrom = "Алексей"
    const sub = await makePaidForOthersSub({
      name: "Netflix",
      price: "799",
      reimbursementFrom: "Алексей С.",
    });

    // The subscription spend (an expense linked to this sub)
    const spendTxn = await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "799",
      currencyCode: "RUB",
      occurredAt: daysAgo(10),
      name: "Netflix",
      subscriptionId: sub.id,
    });

    // Income from Алексей — amount within 2% of 799 (say 799), within 30 days after spend
    const incomeTxn = await makeTransaction(db, {
      accountId: incomeAccId,
      kind: TransactionKind.INCOME,
      amount: "799",
      currencyCode: "RUB",
      occurredAt: daysAgo(5),  // 5 days after spend (within 30 day after window)
      name: "Перевод от Алексей С.",
    });

    const result = await autoMatchReimbursements({
      userId: DEFAULT_USER_ID,
      windowFrom: daysAgo(90),
      windowTo: NOW,
    });

    expect(result.autoLinked).toBe(1);
    expect(result.ambiguousSkipped).toBe(0);

    // Both transactions should now be in a compensation group
    const [spendCheck, incomeCheck] = await Promise.all([
      db.transaction.findUnique({ where: { id: spendTxn.id }, select: { compensationGroupId: true } }),
      db.transaction.findUnique({ where: { id: incomeTxn.id }, select: { compensationGroupId: true } }),
    ]);
    expect(spendCheck?.compensationGroupId).toBeTruthy();
    expect(incomeCheck?.compensationGroupId).toBeTruthy();
    expect(spendCheck?.compensationGroupId).toBe(incomeCheck?.compensationGroupId);
  });

  it("does NOT auto-link when income amount is more than 2% off from spend", async () => {
    const sub = await makePaidForOthersSub({
      name: "Spotify",
      price: "500",
      reimbursementFrom: "Иван",
    });

    await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "500",
      currencyCode: "RUB",
      occurredAt: daysAgo(10),
      name: "Spotify",
      subscriptionId: sub.id,
    });

    await makeTransaction(db, {
      accountId: incomeAccId,
      kind: TransactionKind.INCOME,
      amount: "450",  // 10% off — exceeds 2% AUTO_TOLERANCE
      currencyCode: "RUB",
      occurredAt: daysAgo(5),
      name: "Перевод Иван",
    });

    const result = await autoMatchReimbursements({
      userId: DEFAULT_USER_ID,
      windowFrom: daysAgo(90),
      windowTo: NOW,
    });

    expect(result.autoLinked).toBe(0);
  });

  it("does NOT auto-link when income is outside the 30-day after / 3-day before window", async () => {
    const sub = await makePaidForOthersSub({
      name: "iCloud",
      price: "299",
      reimbursementFrom: "Сергей",
    });

    await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "299",
      currencyCode: "RUB",
      occurredAt: daysAgo(10),
      name: "iCloud",
      subscriptionId: sub.id,
    });

    // Income 45 days after the spend — exceeds 30 day WINDOW_AFTER_DAYS
    await makeTransaction(db, {
      accountId: incomeAccId,
      kind: TransactionKind.INCOME,
      amount: "299",
      currencyCode: "RUB",
      occurredAt: daysFromNow(35),  // 10+35 = 45 days after spend
      name: "Перевод Сергей",
    });

    const result = await autoMatchReimbursements({
      userId: DEFAULT_USER_ID,
      windowFrom: daysAgo(90),
      windowTo: daysFromNow(60),
    });

    expect(result.autoLinked).toBe(0);
  });

  it("does NOT auto-link when income name does not contain the name token", async () => {
    const sub = await makePaidForOthersSub({
      name: "Dropbox",
      price: "300",
      reimbursementFrom: "Мария",
    });

    await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "300",
      currencyCode: "RUB",
      occurredAt: daysAgo(5),
      name: "Dropbox",
      subscriptionId: sub.id,
    });

    // Income that does not contain "мария" in the name
    await makeTransaction(db, {
      accountId: incomeAccId,
      kind: TransactionKind.INCOME,
      amount: "300",
      currencyCode: "RUB",
      occurredAt: daysAgo(1),
      name: "Зарплата",  // no name match
    });

    const result = await autoMatchReimbursements({
      userId: DEFAULT_USER_ID,
      windowFrom: daysAgo(90),
      windowTo: NOW,
    });

    expect(result.autoLinked).toBe(0);
  });
});

describe("autoMatchReimbursements – Захар bundle NEGATIVE case (critical)", () => {
  let accId: string;
  let incomeAccId: string;

  beforeEach(async () => {
    const acc = await makeAccount(db, { name: "Checking", currencyCode: "RUB" });
    const incAcc = await makeAccount(db, { name: "Income Account", currencyCode: "RUB" });
    accId = acc.id;
    incomeAccId = incAcc.id;
  });

  it("does NOT auto-link a bundled payment that covers two subscription spends combined (amount mismatch guard)", async () => {
    // Two subs, each 500 RUB, both paid by "Захар" (reimbursementFrom="Захар")
    const sub1 = await makePaidForOthersSub({ name: "Sub A", price: "500", reimbursementFrom: "Захар" });
    const sub2 = await makePaidForOthersSub({ name: "Sub B", price: "500", reimbursementFrom: "Захар" });

    // Individual spends linked to each sub
    const spend1 = await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "500",
      currencyCode: "RUB",
      occurredAt: daysAgo(10),
      name: "Sub A",
      subscriptionId: sub1.id,
    });
    const spend2 = await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "500",
      currencyCode: "RUB",
      occurredAt: daysAgo(10),
      name: "Sub B",
      subscriptionId: sub2.id,
    });

    // Захар sends a SINGLE bundled payment = 1000 (both subs combined)
    const bundledIncome = await makeTransaction(db, {
      accountId: incomeAccId,
      kind: TransactionKind.INCOME,
      amount: "1000",  // 1000 ≠ 500 ± 2% → amount gate blocks this
      currencyCode: "RUB",
      occurredAt: daysAgo(5),
      name: "Перевод от Захар за подписки",
    });

    const result = await autoMatchReimbursements({
      userId: DEFAULT_USER_ID,
      windowFrom: daysAgo(90),
      windowTo: NOW,
    });

    // The bundle must NOT match either individual spend:
    // - 1000 RUB vs spend1=500: ratio = |1000-500|/500 = 100% > 2% → blocked
    // - 1000 RUB vs spend2=500: same → blocked
    expect(result.autoLinked).toBe(0);
    expect(result.ambiguousSkipped).toBe(0);

    // Verify nothing was grouped
    const [s1, s2, inc] = await Promise.all([
      db.transaction.findUnique({ where: { id: spend1.id }, select: { compensationGroupId: true } }),
      db.transaction.findUnique({ where: { id: spend2.id }, select: { compensationGroupId: true } }),
      db.transaction.findUnique({ where: { id: bundledIncome.id }, select: { compensationGroupId: true } }),
    ]);
    expect(s1?.compensationGroupId).toBeNull();
    expect(s2?.compensationGroupId).toBeNull();
    expect(inc?.compensationGroupId).toBeNull();
  });

  it("skips ambiguous when multiple individual incomes from Захар match a single spend (ambiguity guard)", async () => {
    // One spend 500 RUB; two separate income payments of ~500 from Захар
    // → matching.length > 1 → ambiguousSkipped
    const sub = await makePaidForOthersSub({ name: "Sub C", price: "500", reimbursementFrom: "Захар" });

    const spend = await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "500",
      currencyCode: "RUB",
      occurredAt: daysAgo(10),
      name: "Sub C",
      subscriptionId: sub.id,
    });

    // Two incomes of ~500 from Захар within the time window
    await makeTransaction(db, {
      accountId: incomeAccId,
      kind: TransactionKind.INCOME,
      amount: "500",
      currencyCode: "RUB",
      occurredAt: daysAgo(8),
      name: "Перевод Захар",
    });
    await makeTransaction(db, {
      accountId: incomeAccId,
      kind: TransactionKind.INCOME,
      amount: "498",  // within 2% of 500
      currencyCode: "RUB",
      occurredAt: daysAgo(6),
      name: "Захар возврат",
    });

    const result = await autoMatchReimbursements({
      userId: DEFAULT_USER_ID,
      windowFrom: daysAgo(90),
      windowTo: NOW,
    });

    // Both candidates match → ambiguous → skip
    expect(result.ambiguousSkipped).toBe(1);
    expect(result.autoLinked).toBe(0);

    const spendCheck = await db.transaction.findUnique({ where: { id: spend.id }, select: { compensationGroupId: true } });
    expect(spendCheck?.compensationGroupId).toBeNull();
  });
});

describe("autoMatchReimbursements – IDEMPOTENCY (critical)", () => {
  let accId: string;
  let incomeAccId: string;

  beforeEach(async () => {
    const acc = await makeAccount(db, { name: "Checking", currencyCode: "RUB" });
    const incAcc = await makeAccount(db, { name: "Income Account", currencyCode: "RUB" });
    accId = acc.id;
    incomeAccId = incAcc.id;
  });

  it("running autoMatchReimbursements twice does NOT create duplicate compensation groups", async () => {
    const sub = await makePaidForOthersSub({
      name: "Netflix",
      price: "799",
      reimbursementFrom: "Борис",
    });

    const spendTxn = await makeTransaction(db, {
      accountId: accId,
      kind: TransactionKind.EXPENSE,
      amount: "799",
      currencyCode: "RUB",
      occurredAt: daysAgo(10),
      name: "Netflix",
      subscriptionId: sub.id,
    });

    await makeTransaction(db, {
      accountId: incomeAccId,
      kind: TransactionKind.INCOME,
      amount: "799",
      currencyCode: "RUB",
      occurredAt: daysAgo(5),
      name: "Перевод Борис",
    });

    const opts = {
      userId: DEFAULT_USER_ID,
      windowFrom: daysAgo(90),
      windowTo: NOW,
    };

    // First run
    const result1 = await autoMatchReimbursements(opts);
    expect(result1.autoLinked).toBe(1);

    const spendAfterRun1 = await db.transaction.findUnique({
      where: { id: spendTxn.id },
      select: { compensationGroupId: true },
    });
    const groupId1 = spendAfterRun1!.compensationGroupId;
    expect(groupId1).toBeTruthy();

    // Second run — same data
    const result2 = await autoMatchReimbursements(opts);
    // compensationGroupId is already set → `stillFree.length < 2` → aborts cleanly
    // autoLinked should NOT increase
    expect(result2.autoLinked).toBe(0);

    // Exactly one compensation group in DB for this spend
    const groupCount = await db.compensationGroup.count({ where: { id: groupId1! } });
    expect(groupCount).toBe(1);

    // State should be identical after second run
    const spendAfterRun2 = await db.transaction.findUnique({
      where: { id: spendTxn.id },
      select: { compensationGroupId: true },
    });
    expect(spendAfterRun2!.compensationGroupId).toBe(groupId1);
  });
});
