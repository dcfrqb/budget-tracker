import { TransactionKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getLatestRatesMap } from "@/lib/data/wallet";

const MATCH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes (same-ccy)
const DEFAULT_LOOKBACK_DAYS = 90;

const CROSS_CCY_MATCH_WINDOW_MS = 60 * 60 * 1000; // 60 minutes (cross-ccy P2P bridges are slow)
const CROSS_CCY_FX_TOLERANCE = 0.10; // 10% — P2P sellers quote ±5–10% off mid-market

const TRANSFER_NAME_RE = /между своими|перевод/i;

function isTransferName(name: string): boolean {
  return TRANSFER_NAME_RE.test(name);
}

type CandidateTxn = {
  id: string;
  accountId: string;
  amount: Prisma.Decimal;
  currencyCode: string;
  occurredAt: Date;
  name: string;
  kind: TransactionKind;
  source: string | null;
  note: string | null;
};

type PairingResult = {
  paired: number;
  ambiguousSkipped: number;
  crossCcyPaired: number;
};

/**
 * Same-currency pairing: matches EXPENSE↔INCOME pairs (or orphan TRANSFER↔TRANSFER)
 * with same amount, same currency, within MATCH_WINDOW_MS, with name filter.
 * Updates `claimed` set with all claimed IDs.
 */
async function pairSameCurrency(
  userId: string,
  expenses: CandidateTxn[],
  incomes: CandidateTxn[],
  orphanTransfers: CandidateTxn[],
  claimed: Set<string>,
): Promise<{ paired: number; ambiguousSkipped: number }> {
  let paired = 0;
  let ambiguousSkipped = 0;

  type PairCandidate = { expense: CandidateTxn; income: CandidateTxn; deltaMs: number };

  // Build all valid same-ccy pairs between EXPENSE and INCOME rows
  const pairCandidates: PairCandidate[] = [];

  for (const exp of expenses) {
    if (claimed.has(exp.id)) continue;
    for (const inc of incomes) {
      if (claimed.has(inc.id)) continue;
      if (exp.accountId === inc.accountId) continue;
      if (exp.currencyCode !== inc.currencyCode) continue;
      if (!new Prisma.Decimal(exp.amount).equals(new Prisma.Decimal(inc.amount))) continue;

      const deltaMs = Math.abs(exp.occurredAt.getTime() - inc.occurredAt.getTime());
      if (deltaMs > MATCH_WINDOW_MS) continue;

      if (!isTransferName(exp.name) && !isTransferName(inc.name)) continue;

      pairCandidates.push({ expense: exp, income: inc, deltaMs });
    }
  }

  pairCandidates.sort((a, b) => a.deltaMs - b.deltaMs);

  const expenseIncome: Array<[CandidateTxn, CandidateTxn]> = [];

  for (const pc of pairCandidates) {
    if (claimed.has(pc.expense.id) || claimed.has(pc.income.id)) continue;

    const expUnclaimed = pairCandidates.filter(
      (x) => x.expense.id === pc.expense.id && !claimed.has(x.income.id)
    ).length;
    const incUnclaimed = pairCandidates.filter(
      (x) => x.income.id === pc.income.id && !claimed.has(x.expense.id)
    ).length;

    if (expUnclaimed > 1 || incUnclaimed > 1) {
      console.warn(
        `[transfer-pairing] ambiguous same-ccy match expense=${pc.expense.id} (${expUnclaimed} unclaimed income candidates) income=${pc.income.id} (${incUnclaimed} unclaimed expense candidates) — skipping`
      );
      ambiguousSkipped++;
      continue;
    }

    claimed.add(pc.expense.id);
    claimed.add(pc.income.id);
    expenseIncome.push([pc.expense, pc.income]);
  }

  // Pair orphan TRANSFER rows (both legs already kind=TRANSFER)
  type OrphanCandidate = { a: CandidateTxn; b: CandidateTxn; deltaMs: number };
  const orphanCandidates: OrphanCandidate[] = [];
  for (const a of orphanTransfers) {
    if (claimed.has(a.id)) continue;
    for (const b of orphanTransfers) {
      if (claimed.has(b.id)) continue;
      if (a.id >= b.id) continue;
      if (a.accountId === b.accountId) continue;
      if (a.currencyCode !== b.currencyCode) continue;
      if (!new Prisma.Decimal(a.amount).equals(new Prisma.Decimal(b.amount))) continue;
      const deltaMs = Math.abs(a.occurredAt.getTime() - b.occurredAt.getTime());
      if (deltaMs > MATCH_WINDOW_MS) continue;
      orphanCandidates.push({ a, b, deltaMs });
    }
  }
  orphanCandidates.sort((x, y) => x.deltaMs - y.deltaMs);

  const orphanPairs: Array<[CandidateTxn, CandidateTxn]> = [];

  for (const oc of orphanCandidates) {
    if (claimed.has(oc.a.id) || claimed.has(oc.b.id)) continue;

    const aUnclaimed = orphanCandidates.filter(
      (x) => (x.a.id === oc.a.id || x.b.id === oc.a.id) && !claimed.has(x.a.id) && !claimed.has(x.b.id)
    ).length;
    const bUnclaimed = orphanCandidates.filter(
      (x) => (x.a.id === oc.b.id || x.b.id === oc.b.id) && !claimed.has(x.a.id) && !claimed.has(x.b.id)
    ).length;

    if (aUnclaimed > 1 || bUnclaimed > 1) {
      console.warn(
        `[transfer-pairing] ambiguous orphan match a=${oc.a.id} b=${oc.b.id} — skipping`
      );
      ambiguousSkipped++;
      continue;
    }

    claimed.add(oc.a.id);
    claimed.add(oc.b.id);
    const from = oc.a.id < oc.b.id ? oc.a : oc.b;
    const to = oc.a.id < oc.b.id ? oc.b : oc.a;
    orphanPairs.push([from, to]);
  }

  // Persist expense↔income pairs
  for (const [expense, income] of expenseIncome) {
    try {
      await db.$transaction(async (tx) => {
        const created = await tx.transfer.create({
          data: {
            userId,
            fromAccountId: expense.accountId,
            toAccountId: income.accountId,
            fromAmount: expense.amount,
            toAmount: income.amount,
            fromCcy: expense.currencyCode,
            toCcy: income.currencyCode,
            rate: new Prisma.Decimal(1),
            occurredAt:
              expense.occurredAt < income.occurredAt
                ? expense.occurredAt
                : income.occurredAt,
            note: "auto-paired",
          },
        });
        await tx.transaction.updateMany({
          where: { id: { in: [expense.id, income.id] } },
          data: { kind: TransactionKind.TRANSFER, transferId: created.id },
        });
      });
      paired++;
    } catch (err) {
      console.error(
        `[transfer-pairing] failed to persist pair expense=${expense.id} income=${income.id}:`,
        err
      );
    }
  }

  // Persist orphan TRANSFER pairs
  for (const [from, to] of orphanPairs) {
    try {
      await db.$transaction(async (tx) => {
        const created = await tx.transfer.create({
          data: {
            userId,
            fromAccountId: from.accountId,
            toAccountId: to.accountId,
            fromAmount: from.amount,
            toAmount: to.amount,
            fromCcy: from.currencyCode,
            toCcy: to.currencyCode,
            rate: new Prisma.Decimal(1),
            occurredAt:
              from.occurredAt < to.occurredAt ? from.occurredAt : to.occurredAt,
            note: "auto-paired",
          },
        });
        await tx.transaction.updateMany({
          where: { id: { in: [from.id, to.id] } },
          data: { kind: TransactionKind.TRANSFER, transferId: created.id },
        });
      });
      paired++;
    } catch (err) {
      console.error(
        `[transfer-pairing] failed to persist orphan pair from=${from.id} to=${to.id}:`,
        err
      );
    }
  }

  return { paired, ambiguousSkipped };
}

/**
 * Cross-currency pairing: matches EXPENSE↔INCOME pairs where currencies differ.
 * No name filter — relies on FX rate tolerance (1%) within ±60min window.
 * Runs after same-ccy so unclaimed set is correct.
 *
 * Rate direction: getLatestRatesMap() stores "FROM-TO" keys.
 * For expense.ccy → income.ccy we try:
 *   1. direct key "expCcy-incCcy" → rate = direct
 *   2. inverse key "incCcy-expCcy" → rate = 1/inverse
 * If neither is available, the pair is skipped.
 *
 * The rate represents how many income.ccy you get per 1 expense.ccy.
 * Expected income = expense.amount * rate.
 * fee = expense.amount * rate - income.amount (positive = owner paid a fee; stored as Decimal).
 * fee is null when negative (rate slightly favored owner).
 */
async function pairCrossCurrency(
  userId: string,
  expenses: CandidateTxn[],
  incomes: CandidateTxn[],
  claimed: Set<string>,
): Promise<{ crossCcyPaired: number; ambiguousSkipped: number }> {
  let crossCcyPaired = 0;
  let ambiguousSkipped = 0;

  // Only consider unclaimed rows with different currencies.
  // bybit-p2p rows (both INCOME BUY legs and EXPENSE SELL legs) are owned by
  // pairP2p (exact/±2% order-amount match) — keep them out of this fuzzy
  // 10%-FX pass so an unmatched P2P leg stays plain instead of being loosely
  // paired to the wrong counterpart.
  const unclaimedExpenses = expenses.filter((e) => !claimed.has(e.id) && e.source !== "bybit-p2p");
  const unclaimedIncomes = incomes.filter((i) => !claimed.has(i.id) && i.source !== "bybit-p2p");

  if (unclaimedExpenses.length === 0 || unclaimedIncomes.length === 0) {
    return { crossCcyPaired: 0, ambiguousSkipped: 0 };
  }

  const ratesMap = await getLatestRatesMap();

  type CrossPairCandidate = {
    expense: CandidateTxn;
    income: CandidateTxn;
    deltaMs: number;
    effectiveRate: Prisma.Decimal;
  };

  const candidates: CrossPairCandidate[] = [];

  for (const exp of unclaimedExpenses) {
    for (const inc of unclaimedIncomes) {
      // Cross-ccy only
      if (exp.currencyCode === inc.currencyCode) continue;
      if (exp.accountId === inc.accountId) continue;

      const deltaMs = Math.abs(exp.occurredAt.getTime() - inc.occurredAt.getTime());
      if (deltaMs > CROSS_CCY_MATCH_WINDOW_MS) continue;

      // Resolve rate: expense.ccy → income.ccy (how many inc per 1 exp)
      const directKey = `${exp.currencyCode}-${inc.currencyCode}`;
      const inverseKey = `${inc.currencyCode}-${exp.currencyCode}`;

      let effectiveRate: Prisma.Decimal | null = null;

      const direct = ratesMap.get(directKey);
      if (direct) {
        effectiveRate = direct;
      } else {
        const inverse = ratesMap.get(inverseKey);
        if (inverse && !inverse.isZero()) {
          effectiveRate = new Prisma.Decimal(1).div(inverse);
        }
      }

      if (effectiveRate === null) continue;

      // Tolerance check: expected income = expense.amount * rate
      const expected = exp.amount.times(effectiveRate);
      const diff = expected.minus(inc.amount).abs();
      // tolerance = |expected - actual| / actual <= CROSS_CCY_FX_TOLERANCE
      if (!inc.amount.isZero()) {
        const toleranceRatio = diff.div(inc.amount);
        if (toleranceRatio.greaterThan(new Prisma.Decimal(CROSS_CCY_FX_TOLERANCE))) continue;
      } else {
        continue;
      }

      candidates.push({ expense: exp, income: inc, deltaMs, effectiveRate });
    }
  }

  // Sort by deltaMs ascending (closest match first)
  candidates.sort((a, b) => a.deltaMs - b.deltaMs);

  const toPersist: Array<CrossPairCandidate> = [];

  for (const pc of candidates) {
    if (claimed.has(pc.expense.id) || claimed.has(pc.income.id)) continue;

    // Ambiguity check: count unclaimed matches for each side
    const expUnclaimed = candidates.filter(
      (x) => x.expense.id === pc.expense.id && !claimed.has(x.income.id)
    ).length;
    const incUnclaimed = candidates.filter(
      (x) => x.income.id === pc.income.id && !claimed.has(x.expense.id)
    ).length;

    if (expUnclaimed > 1 || incUnclaimed > 1) {
      console.warn(
        `[transfer-pairing] ambiguous cross-ccy match expense=${pc.expense.id} (${expUnclaimed} unclaimed income candidates) income=${pc.income.id} (${incUnclaimed} unclaimed expense candidates) — skipping`
      );
      ambiguousSkipped++;
      continue;
    }

    claimed.add(pc.expense.id);
    claimed.add(pc.income.id);
    toPersist.push(pc);
  }

  for (const pc of toPersist) {
    const { expense, income, effectiveRate } = pc;

    // fee = expense.amount * rate - income.amount; null if negative (no fee paid)
    const expectedIncome = expense.amount.times(effectiveRate);
    const feeRaw = expectedIncome.minus(income.amount);
    const fee = feeRaw.greaterThan(0) ? feeRaw : null;

    try {
      await db.$transaction(async (tx) => {
        const created = await tx.transfer.create({
          data: {
            userId,
            fromAccountId: expense.accountId,
            toAccountId: income.accountId,
            fromAmount: expense.amount,
            toAmount: income.amount,
            fromCcy: expense.currencyCode,
            toCcy: income.currencyCode,
            rate: effectiveRate,
            fee: fee ?? undefined,
            occurredAt:
              expense.occurredAt < income.occurredAt
                ? expense.occurredAt
                : income.occurredAt,
            note: "auto-paired:cross-ccy",
          },
        });
        await tx.transaction.updateMany({
          where: { id: { in: [expense.id, income.id] } },
          data: { kind: TransactionKind.TRANSFER, transferId: created.id },
        });
      });
      crossCcyPaired++;
    } catch (err) {
      console.error(
        `[transfer-pairing] failed to persist cross-ccy pair expense=${expense.id} income=${income.id}:`,
        err
      );
    }
  }

  return { crossCcyPaired, ambiguousSkipped };
}

const P2P_MATCH_WINDOW_MS = 60 * 60 * 1000; // 60 minutes
// The order's fiat amount usually equals the T-bank payment exactly; a small
// gap (~0.84% — the single occurrence in history) can appear from P2P
// fee/rounding. ±2% covers that with margin while staying tight enough to avoid
// wrong pairs. Exact matches are preferred over near ones (see ambiguity guard).
const P2P_MATCH_AMOUNT_TOLERANCE = 0.02;

/**
 * P2P-specific pairing: matches both legs of Bybit P2P orders against T-bank fiat rows.
 *
 * BUY pass (side=0): bybit-p2p INCOME (USDT received) ↔ T-bank RUB EXPENSE (RUB sent).
 *   Transfer: from=RUB expense → to=USDT income. rate = USDT / fiatAmount (USDT per RUB).
 *
 * SELL pass (side=1): bybit-p2p EXPENSE (USDT sent) ↔ T-bank RUB INCOME (RUB received).
 *   Transfer: from=USDT expense → to=RUB income. rate = RUB income / fiatAmount (RUB per USDT).
 *
 * Both passes share the same `claimed` set. Uses exact fiat-amount from note JSON (±2%
 * tolerance). Skips isTransferName filter. Runs before generic cross-ccy to claim first.
 */
async function pairP2p(
  userId: string,
  expenses: CandidateTxn[],
  incomes: CandidateTxn[],
  claimed: Set<string>,
): Promise<{ p2pPaired: number; ambiguousSkipped: number }> {
  let p2pPaired = 0;
  let ambiguousSkipped = 0;

  type P2pCandidate = {
    income: CandidateTxn;
    expense: CandidateTxn;
    fiatAmount: Prisma.Decimal;
    fiatCcy: string;
    deltaMs: number;
    amountDelta: Prisma.Decimal;
  };

  // ── BUY pass: bybit-p2p INCOME rows ↔ RUB EXPENSE rows ──────────────────────

  const p2pIncomes = incomes.filter((i) => !claimed.has(i.id) && i.source === "bybit-p2p");

  const buyCandidates: P2pCandidate[] = [];

  for (const inc of p2pIncomes) {
    let fiatAmount: Prisma.Decimal;
    let fiatCcy: string;

    try {
      const noteObj = JSON.parse(inc.note ?? "{}") as Record<string, unknown>;
      const rawFiatAmount = typeof noteObj.fiatAmount === "string" ? noteObj.fiatAmount : "";
      fiatCcy = typeof noteObj.fiatCcy === "string" ? noteObj.fiatCcy : "";
      if (!rawFiatAmount || !fiatCcy) continue;
      fiatAmount = new Prisma.Decimal(rawFiatAmount);
    } catch {
      continue;
    }

    for (const exp of expenses) {
      if (claimed.has(exp.id)) continue;
      if (exp.source === "bybit-p2p") continue;
      if (exp.accountId === inc.accountId) continue;
      if (exp.currencyCode !== fiatCcy) continue;

      const expAmount = new Prisma.Decimal(exp.amount);
      const amountDelta = expAmount.minus(fiatAmount).abs();
      if (amountDelta.gt(fiatAmount.mul(P2P_MATCH_AMOUNT_TOLERANCE))) continue;

      const deltaMs = Math.abs(exp.occurredAt.getTime() - inc.occurredAt.getTime());
      if (deltaMs > P2P_MATCH_WINDOW_MS) continue;

      buyCandidates.push({ income: inc, expense: exp, fiatAmount, fiatCcy, deltaMs, amountDelta });
    }
  }

  buyCandidates.sort((a, b) => {
    const ad = a.amountDelta.comparedTo(b.amountDelta);
    if (ad !== 0) return ad;
    return a.deltaMs - b.deltaMs;
  });

  const buyToPersist: Array<P2pCandidate> = [];

  for (const pc of buyCandidates) {
    if (claimed.has(pc.income.id) || claimed.has(pc.expense.id)) continue;

    const incTies = buyCandidates.filter(
      (x) => x.income.id === pc.income.id && !claimed.has(x.expense.id) && x.amountDelta.equals(pc.amountDelta)
    ).length;
    const expTies = buyCandidates.filter(
      (x) => x.expense.id === pc.expense.id && !claimed.has(x.income.id) && x.amountDelta.equals(pc.amountDelta)
    ).length;

    if (incTies > 1 || expTies > 1) {
      console.warn(
        `[transfer-pairing] ambiguous p2p-buy match income=${pc.income.id} (${incTies} equally-close expense candidates) expense=${pc.expense.id} (${expTies} equally-close income candidates) — skipping`
      );
      ambiguousSkipped++;
      continue;
    }

    claimed.add(pc.income.id);
    claimed.add(pc.expense.id);
    buyToPersist.push(pc);
  }

  for (const pc of buyToPersist) {
    const { income, expense, fiatAmount } = pc;

    // rate = USDT received / RUB spent (toCcy per fromCcy)
    const rate = !fiatAmount.isZero()
      ? income.amount.div(fiatAmount)
      : new Prisma.Decimal(0);

    try {
      await db.$transaction(async (tx) => {
        const created = await tx.transfer.create({
          data: {
            userId,
            fromAccountId: expense.accountId,
            toAccountId: income.accountId,
            fromAmount: expense.amount,
            toAmount: income.amount,
            fromCcy: expense.currencyCode,
            toCcy: income.currencyCode,
            rate,
            occurredAt:
              expense.occurredAt < income.occurredAt
                ? expense.occurredAt
                : income.occurredAt,
            note: "auto-paired:p2p",
          },
        });
        await tx.transaction.updateMany({
          where: { id: { in: [expense.id, income.id] } },
          data: { kind: TransactionKind.TRANSFER, transferId: created.id },
        });
      });
      p2pPaired++;
    } catch (err) {
      console.error(
        `[transfer-pairing] failed to persist p2p-buy pair income=${income.id} expense=${expense.id}:`,
        err
      );
    }
  }

  // ── SELL pass: bybit-p2p EXPENSE rows ↔ RUB INCOME rows ────────────────────

  const p2pExpenses = expenses.filter((e) => !claimed.has(e.id) && e.source === "bybit-p2p");

  const sellCandidates: P2pCandidate[] = [];

  for (const exp of p2pExpenses) {
    let fiatAmount: Prisma.Decimal;
    let fiatCcy: string;

    try {
      const noteObj = JSON.parse(exp.note ?? "{}") as Record<string, unknown>;
      const rawFiatAmount = typeof noteObj.fiatAmount === "string" ? noteObj.fiatAmount : "";
      fiatCcy = typeof noteObj.fiatCcy === "string" ? noteObj.fiatCcy : "";
      if (!rawFiatAmount || !fiatCcy) continue;
      fiatAmount = new Prisma.Decimal(rawFiatAmount);
    } catch {
      continue;
    }

    for (const inc of incomes) {
      if (claimed.has(inc.id)) continue;
      if (inc.source === "bybit-p2p") continue;
      if (inc.accountId === exp.accountId) continue;
      if (inc.currencyCode !== fiatCcy) continue;

      const incAmount = new Prisma.Decimal(inc.amount);
      const amountDelta = incAmount.minus(fiatAmount).abs();
      if (amountDelta.gt(fiatAmount.mul(P2P_MATCH_AMOUNT_TOLERANCE))) continue;

      const deltaMs = Math.abs(inc.occurredAt.getTime() - exp.occurredAt.getTime());
      if (deltaMs > P2P_MATCH_WINDOW_MS) continue;

      sellCandidates.push({ income: inc, expense: exp, fiatAmount, fiatCcy, deltaMs, amountDelta });
    }
  }

  sellCandidates.sort((a, b) => {
    const ad = a.amountDelta.comparedTo(b.amountDelta);
    if (ad !== 0) return ad;
    return a.deltaMs - b.deltaMs;
  });

  const sellToPersist: Array<P2pCandidate> = [];

  for (const pc of sellCandidates) {
    if (claimed.has(pc.income.id) || claimed.has(pc.expense.id)) continue;

    const expTies = sellCandidates.filter(
      (x) => x.expense.id === pc.expense.id && !claimed.has(x.income.id) && x.amountDelta.equals(pc.amountDelta)
    ).length;
    const incTies = sellCandidates.filter(
      (x) => x.income.id === pc.income.id && !claimed.has(x.expense.id) && x.amountDelta.equals(pc.amountDelta)
    ).length;

    if (expTies > 1 || incTies > 1) {
      console.warn(
        `[transfer-pairing] ambiguous p2p-sell match expense=${pc.expense.id} (${expTies} equally-close income candidates) income=${pc.income.id} (${incTies} equally-close expense candidates) — skipping`
      );
      ambiguousSkipped++;
      continue;
    }

    claimed.add(pc.expense.id);
    claimed.add(pc.income.id);
    sellToPersist.push(pc);
  }

  for (const pc of sellToPersist) {
    const { income, expense } = pc;

    // rate = RUB received / USDT sold (toCcy per fromCcy = RUB per USDT)
    const rate = !expense.amount.isZero()
      ? income.amount.div(expense.amount)
      : new Prisma.Decimal(0);

    try {
      await db.$transaction(async (tx) => {
        const created = await tx.transfer.create({
          data: {
            userId,
            fromAccountId: expense.accountId,
            toAccountId: income.accountId,
            fromAmount: expense.amount,
            toAmount: income.amount,
            fromCcy: expense.currencyCode,
            toCcy: income.currencyCode,
            rate,
            occurredAt:
              expense.occurredAt < income.occurredAt
                ? expense.occurredAt
                : income.occurredAt,
            note: "auto-paired:p2p",
          },
        });
        await tx.transaction.updateMany({
          where: { id: { in: [expense.id, income.id] } },
          data: { kind: TransactionKind.TRANSFER, transferId: created.id },
        });
      });
      p2pPaired++;
    } catch (err) {
      console.error(
        `[transfer-pairing] failed to persist p2p-sell pair expense=${expense.id} income=${income.id}:`,
        err
      );
    }
  }

  return { p2pPaired, ambiguousSkipped };
}

export async function autoPairTransfers(opts: {
  userId: string;
  windowFrom?: Date;
  windowTo?: Date;
}): Promise<PairingResult> {
  const { userId } = opts;
  const windowTo = opts.windowTo ?? new Date();
  const windowFrom =
    opts.windowFrom ??
    new Date(windowTo.getTime() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      transferId: null,
      kind: { in: [TransactionKind.EXPENSE, TransactionKind.INCOME, TransactionKind.TRANSFER] },
      occurredAt: { gte: windowFrom, lte: windowTo },
    },
    select: {
      id: true,
      accountId: true,
      amount: true,
      currencyCode: true,
      occurredAt: true,
      name: true,
      kind: true,
      source: true,
      note: true,
    },
    orderBy: { occurredAt: "asc" },
  });

  const expenses = candidates.filter((r) => r.kind === TransactionKind.EXPENSE);
  const incomes = candidates.filter((r) => r.kind === TransactionKind.INCOME);
  const orphanTransfers = candidates.filter((r) => r.kind === TransactionKind.TRANSFER);

  // Shared claimed set across all passes.
  // Order: same-ccy → p2p (exact-amount cross-ccy) → generic cross-ccy (FX-tolerance)
  const claimed = new Set<string>();

  const sameCcyResult = await pairSameCurrency(userId, expenses, incomes, orphanTransfers, claimed);
  const p2pResult = await pairP2p(userId, expenses, incomes, claimed);
  const crossCcyResult = await pairCrossCurrency(userId, expenses, incomes, claimed);

  const paired = sameCcyResult.paired;
  const crossCcyPaired = crossCcyResult.crossCcyPaired + p2pResult.p2pPaired;
  const ambiguousSkipped = sameCcyResult.ambiguousSkipped + p2pResult.ambiguousSkipped + crossCcyResult.ambiguousSkipped;

  console.log(
    `[transfer-pairing] done: sameCcy=${paired} p2p=${p2pResult.p2pPaired} crossCcy=${crossCcyResult.crossCcyPaired} ambiguousSkipped=${ambiguousSkipped}`
  );

  return { paired, ambiguousSkipped, crossCcyPaired };
}
