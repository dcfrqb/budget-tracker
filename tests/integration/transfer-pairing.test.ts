/**
 * integration/transfer-pairing.test.ts
 *
 * Integration tests for lib/data/_mutations/transfer-pairing.ts
 * → autoPairTransfers
 *
 * Key constants from the module (verified at source):
 *   MATCH_WINDOW_MS             = 5 * 60 * 1000    (5 min, same-ccy)
 *   CROSS_CCY_MATCH_WINDOW_MS   = 60 * 60 * 1000   (60 min, cross-ccy)
 *   CROSS_CCY_FX_TOLERANCE      = 0.10              (10%)
 *   DEFAULT_LOOKBACK_DAYS       = 90
 *   TRANSFER_NAME_RE            = /между своими|перевод/i
 *
 * Same-ccy name filter: at least ONE leg must match TRANSFER_NAME_RE.
 * Cross-ccy: NO name filter (relies on FX tolerance within ±60 min).
 * P2P: source=="bybit-p2p", note JSON with fiatAmount+fiatCcy, ±2% amount tolerance.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Prisma, TransactionKind } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { makeAccount, makeTransaction } from "@/tests/fixtures/builders";
import { autoPairTransfers } from "@/lib/data/_mutations/transfer-pairing";

// Fixed reference "now" for all window calculations
const NOW = new Date("2024-06-15T12:00:00.000Z");

// Helper: offset from NOW in minutes
function atMinutesOffset(offsetMin: number): Date {
  return new Date(NOW.getTime() + offsetMin * 60 * 1000);
}

// Helper: offset from NOW in hours
function atHoursOffset(offsetHours: number): Date {
  return new Date(NOW.getTime() + offsetHours * 60 * 60 * 1000);
}

describe("autoPairTransfers – same-currency", () => {
  let acc1: string;
  let acc2: string;

  beforeEach(async () => {
    const a1 = await makeAccount(db, { name: "Account A", currencyCode: "RUB" });
    const a2 = await makeAccount(db, { name: "Account B", currencyCode: "RUB" });
    acc1 = a1.id;
    acc2 = a2.id;
  });

  it("pairs EXPENSE+INCOME of equal amount in same currency within 5 min when at least one has transfer name", async () => {
    // EXPENSE from acc1 named "перевод", INCOME to acc2 at same time
    const exp = await makeTransaction(db, {
      accountId: acc1,
      kind: TransactionKind.EXPENSE,
      amount: "5000",
      currencyCode: "RUB",
      occurredAt: NOW,
      name: "перевод на карту",
    });
    const inc = await makeTransaction(db, {
      accountId: acc2,
      kind: TransactionKind.INCOME,
      amount: "5000",
      currencyCode: "RUB",
      occurredAt: atMinutesOffset(1), // +1 min — within 5 min window
      name: "Пополнение счёта",
    });

    const result = await autoPairTransfers({
      userId: DEFAULT_USER_ID,
      windowFrom: new Date(NOW.getTime() - 60 * 60 * 1000),
      windowTo: new Date(NOW.getTime() + 60 * 60 * 1000),
    });

    expect(result.paired).toBe(1);
    expect(result.ambiguousSkipped).toBe(0);

    // Both transactions should now have kind=TRANSFER and share a transferId
    const [expUpdated, incUpdated] = await Promise.all([
      db.transaction.findUnique({ where: { id: exp.id }, select: { kind: true, transferId: true } }),
      db.transaction.findUnique({ where: { id: inc.id }, select: { kind: true, transferId: true } }),
    ]);

    expect(expUpdated?.kind).toBe(TransactionKind.TRANSFER);
    expect(incUpdated?.kind).toBe(TransactionKind.TRANSFER);
    expect(expUpdated?.transferId).toBeTruthy();
    expect(expUpdated?.transferId).toBe(incUpdated?.transferId);
  });

  it("does NOT pair transactions without transfer name (false-positive guard)", async () => {
    // Two opposite-sign same-amount transactions with neutral names
    const exp = await makeTransaction(db, {
      accountId: acc1,
      kind: TransactionKind.EXPENSE,
      amount: "5000",
      currencyCode: "RUB",
      occurredAt: NOW,
      name: "Оплата в магазине",  // not a transfer name
    });
    await makeTransaction(db, {
      accountId: acc2,
      kind: TransactionKind.INCOME,
      amount: "5000",
      currencyCode: "RUB",
      occurredAt: atMinutesOffset(1),
      name: "Зачисление зарплаты",  // not a transfer name
    });

    const result = await autoPairTransfers({
      userId: DEFAULT_USER_ID,
      windowFrom: new Date(NOW.getTime() - 60 * 60 * 1000),
      windowTo: new Date(NOW.getTime() + 60 * 60 * 1000),
    });

    expect(result.paired).toBe(0);
    expect(result.ambiguousSkipped).toBe(0);

    // Transactions should remain their original kind
    const expCheck = await db.transaction.findUnique({ where: { id: exp.id }, select: { kind: true, transferId: true } });
    expect(expCheck?.kind).toBe(TransactionKind.EXPENSE);
    expect(expCheck?.transferId).toBeNull();
  });

  it("does NOT pair when deltaMs exceeds 5 min window", async () => {
    await makeTransaction(db, {
      accountId: acc1,
      kind: TransactionKind.EXPENSE,
      amount: "5000",
      currencyCode: "RUB",
      occurredAt: NOW,
      name: "перевод между своими",
    });
    await makeTransaction(db, {
      accountId: acc2,
      kind: TransactionKind.INCOME,
      amount: "5000",
      currencyCode: "RUB",
      occurredAt: atMinutesOffset(6), // 6 min — exceeds 5 min window
      name: "Пополнение",
    });

    const result = await autoPairTransfers({
      userId: DEFAULT_USER_ID,
      windowFrom: new Date(NOW.getTime() - 60 * 60 * 1000),
      windowTo: new Date(NOW.getTime() + 60 * 60 * 1000),
    });

    expect(result.paired).toBe(0);
  });

  it("does NOT pair when amounts differ", async () => {
    await makeTransaction(db, {
      accountId: acc1,
      kind: TransactionKind.EXPENSE,
      amount: "5000",
      currencyCode: "RUB",
      occurredAt: NOW,
      name: "перевод",
    });
    await makeTransaction(db, {
      accountId: acc2,
      kind: TransactionKind.INCOME,
      amount: "5001", // different amount
      currencyCode: "RUB",
      occurredAt: atMinutesOffset(1),
      name: "Пополнение",
    });

    const result = await autoPairTransfers({
      userId: DEFAULT_USER_ID,
      windowFrom: new Date(NOW.getTime() - 60 * 60 * 1000),
      windowTo: new Date(NOW.getTime() + 60 * 60 * 1000),
    });

    expect(result.paired).toBe(0);
  });

  it("skips ambiguous pair when multiple incomes match the same expense", async () => {
    // One expense, two incomes with same amount + within window + one has transfer name
    await makeTransaction(db, {
      accountId: acc1,
      kind: TransactionKind.EXPENSE,
      amount: "5000",
      currencyCode: "RUB",
      occurredAt: NOW,
      name: "перевод между своими",
    });
    const acc3 = (await makeAccount(db, { name: "Account C", currencyCode: "RUB" })).id;
    await makeTransaction(db, {
      accountId: acc2,
      kind: TransactionKind.INCOME,
      amount: "5000",
      currencyCode: "RUB",
      occurredAt: atMinutesOffset(1),
      name: "Пополнение",
    });
    await makeTransaction(db, {
      accountId: acc3,
      kind: TransactionKind.INCOME,
      amount: "5000",
      currencyCode: "RUB",
      occurredAt: atMinutesOffset(2),
      name: "Между своими",
    });

    const result = await autoPairTransfers({
      userId: DEFAULT_USER_ID,
      windowFrom: new Date(NOW.getTime() - 60 * 60 * 1000),
      windowTo: new Date(NOW.getTime() + 60 * 60 * 1000),
    });

    expect(result.ambiguousSkipped).toBeGreaterThan(0);
    expect(result.paired).toBe(0);
  });

  it("does NOT pair from same account to same account", async () => {
    // Both transactions on the same account — should never be paired
    await makeTransaction(db, {
      accountId: acc1,
      kind: TransactionKind.EXPENSE,
      amount: "5000",
      currencyCode: "RUB",
      occurredAt: NOW,
      name: "перевод",
    });
    await makeTransaction(db, {
      accountId: acc1, // same account
      kind: TransactionKind.INCOME,
      amount: "5000",
      currencyCode: "RUB",
      occurredAt: atMinutesOffset(1),
      name: "пополнение",
    });

    const result = await autoPairTransfers({
      userId: DEFAULT_USER_ID,
      windowFrom: new Date(NOW.getTime() - 60 * 60 * 1000),
      windowTo: new Date(NOW.getTime() + 60 * 60 * 1000),
    });

    expect(result.paired).toBe(0);
  });

  it("is idempotent — running twice does not double-pair", async () => {
    const exp = await makeTransaction(db, {
      accountId: acc1,
      kind: TransactionKind.EXPENSE,
      amount: "5000",
      currencyCode: "RUB",
      occurredAt: NOW,
      name: "перевод на карту",
    });
    await makeTransaction(db, {
      accountId: acc2,
      kind: TransactionKind.INCOME,
      amount: "5000",
      currencyCode: "RUB",
      occurredAt: atMinutesOffset(1),
      name: "Пополнение",
    });

    const opts = {
      userId: DEFAULT_USER_ID,
      windowFrom: new Date(NOW.getTime() - 60 * 60 * 1000),
      windowTo: new Date(NOW.getTime() + 60 * 60 * 1000),
    };

    const result1 = await autoPairTransfers(opts);
    expect(result1.paired).toBe(1);

    const result2 = await autoPairTransfers(opts);
    // Already paired transactions have transferId set → excluded from candidates
    expect(result2.paired).toBe(0);

    // Exactly one Transfer in DB
    const expFinal = await db.transaction.findUnique({ where: { id: exp.id }, select: { transferId: true } });
    const transferCount = await db.transfer.count({ where: { id: expFinal!.transferId! } });
    expect(transferCount).toBe(1);
  });
});

describe("autoPairTransfers – cross-currency", () => {
  let rubAcc: string;
  let usdAcc: string;

  beforeEach(async () => {
    const a1 = await makeAccount(db, { name: "RUB Account", currencyCode: "RUB" });
    const a2 = await makeAccount(db, { name: "USD Account", currencyCode: "USD" });
    rubAcc = a1.id;
    usdAcc = a2.id;
  });

  it("pairs RUB EXPENSE to USD INCOME using seeded rate (100 RUB = 1 USD) within 10% tolerance, no name filter", async () => {
    // Seeded rate: USD→RUB=100 so RUB→USD rate = 0.01
    // Expense: 1000 RUB → expected income: 10 USD (1000 * 0.01 = 10)
    // Actual income: 9.8 USD → diff/expected = 0.2/10 = 2% — within 10%
    const exp = await makeTransaction(db, {
      accountId: rubAcc,
      kind: TransactionKind.EXPENSE,
      amount: "1000",
      currencyCode: "RUB",
      occurredAt: NOW,
      name: "Покупка USDT",  // no transfer name needed for cross-ccy
    });
    const inc = await makeTransaction(db, {
      accountId: usdAcc,
      kind: TransactionKind.INCOME,
      amount: "9.8",
      currencyCode: "USD",
      occurredAt: atMinutesOffset(10), // 10 min — within 60 min cross-ccy window
      name: "Зачисление USD",
    });

    const result = await autoPairTransfers({
      userId: DEFAULT_USER_ID,
      windowFrom: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
      windowTo: new Date(NOW.getTime() + 2 * 60 * 60 * 1000),
    });

    expect(result.crossCcyPaired).toBe(1);

    const [expUpdated, incUpdated] = await Promise.all([
      db.transaction.findUnique({ where: { id: exp.id }, select: { kind: true, transferId: true } }),
      db.transaction.findUnique({ where: { id: inc.id }, select: { kind: true, transferId: true } }),
    ]);
    expect(expUpdated?.kind).toBe(TransactionKind.TRANSFER);
    expect(incUpdated?.kind).toBe(TransactionKind.TRANSFER);
    expect(expUpdated?.transferId).toBe(incUpdated?.transferId);
  });

  it("does NOT pair cross-ccy when amount ratio exceeds 10% FX tolerance", async () => {
    // Expense: 1000 RUB → expected: 10 USD; actual: 8 USD → diff = 2/10 = 20% > 10%
    await makeTransaction(db, {
      accountId: rubAcc,
      kind: TransactionKind.EXPENSE,
      amount: "1000",
      currencyCode: "RUB",
      occurredAt: NOW,
      name: "Обмен валюты",
    });
    await makeTransaction(db, {
      accountId: usdAcc,
      kind: TransactionKind.INCOME,
      amount: "8",  // 20% off — exceeds tolerance
      currencyCode: "USD",
      occurredAt: atMinutesOffset(5),
      name: "Пополнение",
    });

    const result = await autoPairTransfers({
      userId: DEFAULT_USER_ID,
      windowFrom: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
      windowTo: new Date(NOW.getTime() + 2 * 60 * 60 * 1000),
    });

    expect(result.crossCcyPaired).toBe(0);
  });

  it("does NOT pair cross-ccy when time gap exceeds 60 min window", async () => {
    // Amount matches but 90 min gap — exceeds 60 min window
    await makeTransaction(db, {
      accountId: rubAcc,
      kind: TransactionKind.EXPENSE,
      amount: "1000",
      currencyCode: "RUB",
      occurredAt: NOW,
      name: "Обмен",
    });
    await makeTransaction(db, {
      accountId: usdAcc,
      kind: TransactionKind.INCOME,
      amount: "9.9",  // within 10% of 10 USD
      currencyCode: "USD",
      occurredAt: atHoursOffset(1.5), // 90 min — exceeds 60 min window
      name: "Пополнение USD",
    });

    const result = await autoPairTransfers({
      userId: DEFAULT_USER_ID,
      windowFrom: new Date(NOW.getTime() - 4 * 60 * 60 * 1000),
      windowTo: new Date(NOW.getTime() + 4 * 60 * 60 * 1000),
    });

    expect(result.crossCcyPaired).toBe(0);
  });

  it("cross-ccy pairing skips the name filter (neutral names are fine)", async () => {
    // Seeded rate: RUB→USD = 0.01; 500 RUB → 5 USD expected; 4.9 USD actual (2% off)
    const exp = await makeTransaction(db, {
      accountId: rubAcc,
      kind: TransactionKind.EXPENSE,
      amount: "500",
      currencyCode: "RUB",
      occurredAt: NOW,
      name: "Покупка кофе",  // completely neutral name — no "перевод"/"между своими"
    });
    await makeTransaction(db, {
      accountId: usdAcc,
      kind: TransactionKind.INCOME,
      amount: "4.9",  // 2% off 5 USD — within 10%
      currencyCode: "USD",
      occurredAt: atMinutesOffset(15),
      name: "Зачисление",
    });

    const result = await autoPairTransfers({
      userId: DEFAULT_USER_ID,
      windowFrom: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
      windowTo: new Date(NOW.getTime() + 2 * 60 * 60 * 1000),
    });

    // Should pair because name filter is not applied for cross-ccy
    expect(result.crossCcyPaired).toBe(1);

    const expUpdated = await db.transaction.findUnique({ where: { id: exp.id }, select: { kind: true } });
    expect(expUpdated?.kind).toBe(TransactionKind.TRANSFER);
  });
});
