/**
 * fixtures/builders.ts
 *
 * Composable factory builders for integration tests.
 * Each builder creates a single domain object with sensible defaults,
 * accepting overrides for fields that tests need to vary.
 *
 * All builders:
 * - Return the created row (typed)
 * - Use Prisma.Decimal for money fields (never float)
 * - Are idempotent under truncateAll (no external state)
 * - Accept partial overrides via spreads
 */

import { PrismaClient, Prisma, TransactionStatus, TransactionKind, AccountKind, BudgetMode, FundKind } from "@prisma/client";
import { DEFAULT_USER_ID } from "@/lib/constants";

// ─────────────────────────────────────────────────────────────
// ACCOUNT BUILDER
// ─────────────────────────────────────────────────────────────

export interface MakeAccountOpts {
  userId?: string;
  name?: string;
  kind?: AccountKind;
  currencyCode?: string;
  balance?: string | Prisma.Decimal;
  institutionId?: string;
  isArchived?: boolean;
  includeInAnalytics?: boolean;
}

export async function makeAccount(
  db: PrismaClient,
  opts: MakeAccountOpts = {},
): Promise<{ id: string; name: string; currencyCode: string; balance: Prisma.Decimal }> {
  const {
    userId = DEFAULT_USER_ID,
    name = "Test Account",
    kind = AccountKind.CARD,
    currencyCode = "RUB",
    balance = "100000",
    isArchived = false,
    includeInAnalytics = true,
  } = opts;

  const account = await db.account.create({
    data: {
      userId,
      name,
      kind,
      currencyCode,
      balance: new Prisma.Decimal(balance),
      isArchived,
      includeInAnalytics,
      sortOrder: 0,
    },
    select: { id: true, name: true, currencyCode: true, balance: true },
  });

  return account;
}

// ─────────────────────────────────────────────────────────────
// TRANSACTION BUILDER
// ─────────────────────────────────────────────────────────────

export interface MakeTransactionOpts {
  userId?: string;
  accountId: string; // required
  categoryId?: string;
  kind?: TransactionKind;
  status?: TransactionStatus;
  amount?: string | Prisma.Decimal;
  currencyCode?: string;
  occurredAt?: Date;
  name?: string;
  transferId?: string | null;
  compensationGroupId?: string | null;
  subscriptionId?: string | null;
  loanId?: string | null;
  loanPaymentId?: string | null;
  fundId?: string | null;
  personalDebtId?: string | null;
  longProjectId?: string | null;
  plannedEventId?: string | null;
  workSourceId?: string | null;
  freelanceOrderId?: string | null;
}

export async function makeTransaction(
  db: PrismaClient,
  opts: MakeTransactionOpts,
): Promise<{
  id: string;
  kind: TransactionKind;
  amount: Prisma.Decimal;
  currencyCode: string;
  status: TransactionStatus;
  occurredAt: Date;
}> {
  if (!opts.accountId) {
    throw new Error("makeTransaction: accountId is required");
  }

  // Get account to infer categoryId if not provided
  let categoryId: string | null = opts.categoryId ?? null;
  if (!categoryId && opts.kind === TransactionKind.EXPENSE) {
    // Auto-find first EXPENSE category for test user
    const cat = await db.category.findFirst({
      where: { userId: opts.userId ?? DEFAULT_USER_ID, kind: "EXPENSE" },
      select: { id: true },
    });
    categoryId = cat?.id ?? null;
  }

  const {
    userId = DEFAULT_USER_ID,
    kind = TransactionKind.EXPENSE,
    status = TransactionStatus.DONE,
    amount = "1000",
    currencyCode = "RUB",
    occurredAt = new Date(),
    name = "Test Transaction",
  } = opts;

  const transaction = await db.transaction.create({
    data: {
      userId,
      accountId: opts.accountId,
      categoryId,
      kind,
      status,
      amount: new Prisma.Decimal(amount),
      currencyCode,
      occurredAt,
      name,
      transferId: opts.transferId ?? null,
      compensationGroupId: opts.compensationGroupId ?? null,
      subscriptionId: opts.subscriptionId ?? null,
      loanId: opts.loanId ?? null,
      loanPaymentId: opts.loanPaymentId ?? null,
      fundId: opts.fundId ?? null,
      personalDebtId: opts.personalDebtId ?? null,
      longProjectId: opts.longProjectId ?? null,
      plannedEventId: opts.plannedEventId ?? null,
      workSourceId: opts.workSourceId ?? null,
      freelanceOrderId: opts.freelanceOrderId ?? null,
    },
    select: { id: true, kind: true, amount: true, currencyCode: true, status: true, occurredAt: true },
  });

  return transaction;
}

// ─────────────────────────────────────────────────────────────
// EXCHANGE RATE BUILDER
// ─────────────────────────────────────────────────────────────

export interface MakeExchangeRateOpts {
  fromCcy?: string;
  toCcy?: string;
  rate?: string | Prisma.Decimal;
  recordedAt?: Date;
}

export async function makeExchangeRate(
  db: PrismaClient,
  opts: MakeExchangeRateOpts = {},
): Promise<{ id: string; fromCcy: string; toCcy: string; rate: Prisma.Decimal }> {
  const {
    fromCcy = "RUB",
    toCcy = "USD",
    rate = "0.01", // default: 1 RUB = 0.01 USD
    recordedAt = new Date(),
  } = opts;

  const exRate = await db.exchangeRate.create({
    data: {
      fromCcy,
      toCcy,
      rate: new Prisma.Decimal(rate),
      recordedAt,
    },
    select: { id: true, fromCcy: true, toCcy: true, rate: true },
  });

  return exRate;
}

// ─────────────────────────────────────────────────────────────
// SUBSCRIPTION BUILDER
// ─────────────────────────────────────────────────────────────

export interface MakeSubscriptionOpts {
  userId?: string;
  name?: string;
  price?: string | Prisma.Decimal;
  currencyCode?: string;
  billingIntervalMonths?: number;
  nextPaymentDate?: Date;
  categoryId?: string | null;
  isActive?: boolean;
}

export async function makeSubscription(
  db: PrismaClient,
  opts: MakeSubscriptionOpts = {},
): Promise<{ id: string; name: string; price: Prisma.Decimal; nextPaymentDate: Date }> {
  const {
    userId = DEFAULT_USER_ID,
    name = "Test Subscription",
    price = "500",
    currencyCode = "RUB",
    billingIntervalMonths = 1,
    nextPaymentDate = new Date(),
    isActive = true,
  } = opts;

  const sub = await db.subscription.create({
    data: {
      userId,
      name,
      price: new Prisma.Decimal(price),
      currencyCode,
      billingIntervalMonths,
      nextPaymentDate,
      categoryId: opts.categoryId ?? null,
      isActive,
      sharingType: "PERSONAL",
    },
    select: { id: true, name: true, price: true, nextPaymentDate: true },
  });

  return sub;
}

// ─────────────────────────────────────────────────────────────
// LOAN BUILDER
// ─────────────────────────────────────────────────────────────

export interface MakeLoanOpts {
  userId?: string;
  name?: string;
  principal?: string | Prisma.Decimal;
  annualRatePct?: string | Prisma.Decimal;
  termMonths?: number;
  startDate?: Date;
  currencyCode?: string;
  accountId?: string | null;
}

export async function makeLoan(
  db: PrismaClient,
  opts: MakeLoanOpts = {},
): Promise<{ id: string; name: string; principal: Prisma.Decimal; annualRatePct: Prisma.Decimal }> {
  const {
    userId = DEFAULT_USER_ID,
    name = "Test Loan",
    principal = "100000",
    annualRatePct = "12",
    termMonths = 60,
    startDate = new Date(),
    currencyCode = "RUB",
  } = opts;

  const loan = await db.loan.create({
    data: {
      userId,
      name,
      principal: new Prisma.Decimal(principal),
      annualRatePct: new Prisma.Decimal(annualRatePct),
      termMonths,
      startDate,
      currencyCode,
      accountId: opts.accountId ?? null,
    },
    select: { id: true, name: true, principal: true, annualRatePct: true },
  });

  return loan;
}

// ─────────────────────────────────────────────────────────────
// LOAN PAYMENT BUILDER
// ─────────────────────────────────────────────────────────────

export interface MakeLoanPaymentOpts {
  loanId: string; // required
  paidAt?: Date;
  totalAmount?: string | Prisma.Decimal;
  principalPart?: string | Prisma.Decimal;
  interestPart?: string | Prisma.Decimal;
}

export async function makeLoanPayment(
  db: PrismaClient,
  opts: MakeLoanPaymentOpts,
): Promise<{ id: string; totalAmount: Prisma.Decimal; principalPart: Prisma.Decimal }> {
  if (!opts.loanId) {
    throw new Error("makeLoanPayment: loanId is required");
  }

  const {
    paidAt = new Date(),
    totalAmount = "2000",
    principalPart = "1800",
    interestPart = "200",
  } = opts;

  const payment = await db.loanPayment.create({
    data: {
      loanId: opts.loanId,
      paidAt,
      totalAmount: new Prisma.Decimal(totalAmount),
      principalPart: new Prisma.Decimal(principalPart),
      interestPart: new Prisma.Decimal(interestPart),
    },
    select: { id: true, totalAmount: true, principalPart: true },
  });

  return payment;
}

// ─────────────────────────────────────────────────────────────
// FUND BUILDER
// ─────────────────────────────────────────────────────────────

export interface MakeFundOpts {
  userId?: string;
  kind?: FundKind;
  name?: string;
  goalAmount?: string | Prisma.Decimal;
  currentAmount?: string | Prisma.Decimal;
  currencyCode?: string;
  targetDate?: Date | null;
}

export async function makeFund(
  db: PrismaClient,
  opts: MakeFundOpts = {},
): Promise<{ id: string; name: string; goalAmount: Prisma.Decimal; currentAmount: Prisma.Decimal }> {
  const {
    userId = DEFAULT_USER_ID,
    kind = FundKind.OTHER,
    name = "Test Fund",
    goalAmount = "50000",
    currentAmount = "10000",
    currencyCode = "RUB",
    targetDate = null,
  } = opts;

  const fund = await db.fund.create({
    data: {
      userId,
      kind,
      name,
      goalAmount: new Prisma.Decimal(goalAmount),
      currentAmount: new Prisma.Decimal(currentAmount),
      currencyCode,
      targetDate,
    },
    select: { id: true, name: true, goalAmount: true, currentAmount: true },
  });

  return fund;
}

// ─────────────────────────────────────────────────────────────
// PLANNED EVENT BUILDER
// ─────────────────────────────────────────────────────────────

export interface MakePlannedEventOpts {
  userId?: string;
  kind?: "BIRTHDAY" | "HOLIDAY" | "TRIP" | "PURCHASE" | "OTHER";
  name?: string;
  eventDate?: Date;
  fundId?: string | null;
  expectedAmount?: string | Prisma.Decimal | null;
  currencyCode?: string | null;
}

export async function makePlannedEvent(
  db: PrismaClient,
  opts: MakePlannedEventOpts = {},
): Promise<{ id: string; name: string; eventDate: Date }> {
  const {
    userId = DEFAULT_USER_ID,
    kind = "OTHER",
    name = "Test Event",
    eventDate = new Date(),
  } = opts;

  const event = await db.plannedEvent.create({
    data: {
      userId,
      kind,
      name,
      eventDate,
      fundId: opts.fundId ?? null,
      expectedAmount: opts.expectedAmount ? new Prisma.Decimal(opts.expectedAmount) : null,
      currencyCode: opts.currencyCode ?? null,
    },
    select: { id: true, name: true, eventDate: true },
  });

  return event;
}

// ─────────────────────────────────────────────────────────────
// WORK SOURCE BUILDER (for income/hours-calc tests)
// ─────────────────────────────────────────────────────────────

export interface MakeWorkSourceOpts {
  userId?: string;
  name?: string;
  kind?: "EMPLOYMENT" | "FREELANCE" | "ONE_TIME";
  currencyCode?: string;
  rateType?: "HOURLY" | "MONTHLY" | "PER_TASK" | "DAILY" | "COMMISSION_PCT";
  rateAmount?: string | Prisma.Decimal;
  payDay?: number; // for EMPLOYMENT (1..31)
  taxRatePct?: string | Prisma.Decimal;
  isActive?: boolean;
}

export async function makeWorkSource(
  db: PrismaClient,
  opts: MakeWorkSourceOpts = {},
): Promise<{ id: string; name: string; rateAmount: Prisma.Decimal | null }> {
  const {
    userId = DEFAULT_USER_ID,
    name = "Test Work Source",
    kind = "FREELANCE",
    currencyCode = "RUB",
    rateType = "HOURLY",
    rateAmount = "1000",
    payDay = null,
    taxRatePct = null,
    isActive = true,
  } = opts;

  const source = await db.workSource.create({
    data: {
      userId,
      name,
      kind,
      currencyCode,
      rateType,
      rateAmount: new Prisma.Decimal(rateAmount),
      payDay,
      taxRatePct: taxRatePct ? new Prisma.Decimal(taxRatePct) : null,
      isActive,
    },
    select: { id: true, name: true, rateAmount: true },
  });

  return source;
}

// ─────────────────────────────────────────────────────────────
// LONG PROJECT BUILDER
// ─────────────────────────────────────────────────────────────

export interface MakeLongProjectOpts {
  userId?: string;
  name?: string;
  budget?: string | Prisma.Decimal;
  currencyCode?: string;
  startDate?: Date;
  endDate?: Date | null;
  categoryId?: string | null;
}

export async function makeLongProject(
  db: PrismaClient,
  opts: MakeLongProjectOpts = {},
): Promise<{ id: string; name: string; budget: Prisma.Decimal }> {
  const {
    userId = DEFAULT_USER_ID,
    name = "Test Project",
    budget = "50000",
    currencyCode = "RUB",
    startDate = new Date(),
    endDate = null,
  } = opts;

  const project = await db.longProject.create({
    data: {
      userId,
      name,
      budget: new Prisma.Decimal(budget),
      currencyCode,
      startDate,
      endDate,
      categoryId: opts.categoryId ?? null,
    },
    select: { id: true, name: true, budget: true },
  });

  return project;
}

// ─────────────────────────────────────────────────────────────
// PERSONAL DEBT BUILDER
// ─────────────────────────────────────────────────────────────

export interface MakePersonalDebtOpts {
  userId?: string;
  direction?: "LENT" | "BORROWED";
  counterparty?: string;
  principal?: string | Prisma.Decimal;
  currencyCode?: string;
  openedAt?: Date;
  dueAt?: Date | null;
}

export async function makePersonalDebt(
  db: PrismaClient,
  opts: MakePersonalDebtOpts = {},
): Promise<{ id: string; direction: string; principal: Prisma.Decimal }> {
  const {
    userId = DEFAULT_USER_ID,
    direction = "LENT",
    counterparty = "John Doe",
    principal = "10000",
    currencyCode = "RUB",
    openedAt = new Date(),
    dueAt = null,
  } = opts;

  const debt = await db.personalDebt.create({
    data: {
      userId,
      direction,
      counterparty,
      principal: new Prisma.Decimal(principal),
      currencyCode,
      openedAt,
      dueAt,
    },
    select: { id: true, direction: true, principal: true },
  });

  return debt;
}

// ─────────────────────────────────────────────────────────────
// COMPENSATION GROUP BUILDER (aggregator for multi-leg transactions)
// ─────────────────────────────────────────────────────────────

export interface MakeCompensationGroupOpts {
  userId?: string;
  mainTxnId: string; // required
  nettoBase?: string | Prisma.Decimal;
  nettoSign?: number; // +1 or -1
  baseCcy?: string;
  occurredAt?: Date;
  kind?: "COMPENSATION" | "MERGE";
  categoryIdForAggregation?: string | null;
}

export async function makeCompensationGroup(
  db: PrismaClient,
  opts: MakeCompensationGroupOpts,
): Promise<{ id: string; mainTxnId: string; nettoBase: Prisma.Decimal }> {
  if (!opts.mainTxnId) {
    throw new Error("makeCompensationGroup: mainTxnId is required");
  }

  const {
    userId = DEFAULT_USER_ID,
    nettoBase = "10000",
    nettoSign = -1,
    baseCcy = "RUB",
    occurredAt = new Date(),
    kind = "COMPENSATION",
  } = opts;

  const group = await db.compensationGroup.create({
    data: {
      userId,
      mainTxnId: opts.mainTxnId,
      nettoBase: new Prisma.Decimal(nettoBase),
      nettoSign,
      baseCcy,
      occurredAt,
      kind,
      categoryIdForAggregation: opts.categoryIdForAggregation ?? null,
    },
    select: { id: true, mainTxnId: true, nettoBase: true },
  });

  return group;
}

// ─────────────────────────────────────────────────────────────
// TRANSFER BUILDER (between accounts)
// ─────────────────────────────────────────────────────────────

export interface MakeTransferOpts {
  userId?: string;
  fromAccountId: string; // required
  toAccountId: string; // required
  fromAmount?: string | Prisma.Decimal;
  toAmount?: string | Prisma.Decimal;
  fromCcy?: string;
  toCcy?: string;
  rate?: string | Prisma.Decimal;
  fee?: string | Prisma.Decimal | null;
  occurredAt?: Date;
}

export async function makeTransfer(
  db: PrismaClient,
  opts: MakeTransferOpts,
): Promise<{ id: string; fromAmount: Prisma.Decimal; toAmount: Prisma.Decimal }> {
  if (!opts.fromAccountId || !opts.toAccountId) {
    throw new Error("makeTransfer: fromAccountId and toAccountId are required");
  }

  const {
    userId = DEFAULT_USER_ID,
    fromAmount = "1000",
    toAmount = "100",
    fromCcy = "RUB",
    toCcy = "USD",
    rate = "0.01",
    fee = null,
    occurredAt = new Date(),
  } = opts;

  const transfer = await db.transfer.create({
    data: {
      userId,
      fromAccountId: opts.fromAccountId,
      toAccountId: opts.toAccountId,
      fromAmount: new Prisma.Decimal(fromAmount),
      toAmount: new Prisma.Decimal(toAmount),
      fromCcy,
      toCcy,
      rate: new Prisma.Decimal(rate),
      fee: fee ? new Prisma.Decimal(fee) : null,
      occurredAt,
    },
    select: { id: true, fromAmount: true, toAmount: true },
  });

  return transfer;
}
