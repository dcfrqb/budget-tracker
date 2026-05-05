import { TransactionKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const MATCH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_LOOKBACK_DAYS = 90;

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
};

export async function autoPairTransfers(opts: {
  userId: string;
  windowFrom?: Date;
  windowTo?: Date;
}): Promise<{ paired: number; ambiguousSkipped: number }> {
  const { userId } = opts;
  const windowTo = opts.windowTo ?? new Date();
  const windowFrom =
    opts.windowFrom ??
    new Date(windowTo.getTime() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  // Fetch all candidate rows: unpaired, not deleted, in window
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
    },
    orderBy: { occurredAt: "asc" },
  });

  // Separate into buckets by kind
  const expenses = candidates.filter((r) => r.kind === TransactionKind.EXPENSE);
  const incomes = candidates.filter((r) => r.kind === TransactionKind.INCOME);
  const orphanTransfers = candidates.filter((r) => r.kind === TransactionKind.TRANSFER);

  let paired = 0;
  let ambiguousSkipped = 0;

  // Track claimed IDs to prevent double-pairing within the batch
  const claimed = new Set<string>();

  type PairCandidate = { expense: CandidateTxn; income: CandidateTxn; deltaMs: number };

  // Build all valid pairs between EXPENSE and INCOME rows
  const pairCandidates: PairCandidate[] = [];

  for (const exp of expenses) {
    for (const inc of incomes) {
      if (exp.accountId === inc.accountId) continue;
      if (exp.currencyCode !== inc.currencyCode) continue;
      if (!new Prisma.Decimal(exp.amount).equals(new Prisma.Decimal(inc.amount))) continue;

      const deltaMs = Math.abs(exp.occurredAt.getTime() - inc.occurredAt.getTime());
      if (deltaMs > MATCH_WINDOW_MS) continue;

      // Conservative naming filter: at least one row must look like a transfer
      if (!isTransferName(exp.name) && !isTransferName(inc.name)) continue;

      pairCandidates.push({ expense: exp, income: inc, deltaMs });
    }
  }

  // Sort by delta ascending so we greedily pick closest matches first
  pairCandidates.sort((a, b) => a.deltaMs - b.deltaMs);

  // Detect ambiguous: count how many times each row appears in pairCandidates
  const expenseMatchCount = new Map<string, number>();
  const incomeMatchCount = new Map<string, number>();
  for (const pc of pairCandidates) {
    expenseMatchCount.set(pc.expense.id, (expenseMatchCount.get(pc.expense.id) ?? 0) + 1);
    incomeMatchCount.set(pc.income.id, (incomeMatchCount.get(pc.income.id) ?? 0) + 1);
  }

  const expenseIncome: Array<[CandidateTxn, CandidateTxn]> = [];

  for (const pc of pairCandidates) {
    if (claimed.has(pc.expense.id) || claimed.has(pc.income.id)) continue;

    const expCount = expenseMatchCount.get(pc.expense.id) ?? 1;
    const incCount = incomeMatchCount.get(pc.income.id) ?? 1;

    // Count unclaimed remaining matches for each
    const expUnclaimed = pairCandidates.filter(
      (x) => x.expense.id === pc.expense.id && !claimed.has(x.income.id)
    ).length;
    const incUnclaimed = pairCandidates.filter(
      (x) => x.income.id === pc.income.id && !claimed.has(x.expense.id)
    ).length;

    if (expUnclaimed > 1 || incUnclaimed > 1) {
      console.warn(
        `[transfer-pairing] ambiguous match for expense=${pc.expense.id} (${expCount} candidates) income=${pc.income.id} (${incCount} candidates) — skipping`
      );
      ambiguousSkipped++;
      continue;
    }

    claimed.add(pc.expense.id);
    claimed.add(pc.income.id);
    expenseIncome.push([pc.expense, pc.income]);
  }

  // Pair orphan TRANSFER rows (both legs already kind=TRANSFER)
  const orphanPairs: Array<[CandidateTxn, CandidateTxn]> = [];
  const orphanMatchCounts = new Map<string, number>();

  for (const a of orphanTransfers) {
    for (const b of orphanTransfers) {
      if (a.id >= b.id) continue; // avoid duplicates, deterministic order
      if (a.accountId === b.accountId) continue;
      if (a.currencyCode !== b.currencyCode) continue;
      if (!new Prisma.Decimal(a.amount).equals(new Prisma.Decimal(b.amount))) continue;
      const deltaMs = Math.abs(a.occurredAt.getTime() - b.occurredAt.getTime());
      if (deltaMs > MATCH_WINDOW_MS) continue;

      orphanMatchCounts.set(a.id, (orphanMatchCounts.get(a.id) ?? 0) + 1);
      orphanMatchCounts.set(b.id, (orphanMatchCounts.get(b.id) ?? 0) + 1);
    }
  }

  // Sort orphan candidates by delta
  type OrphanCandidate = { a: CandidateTxn; b: CandidateTxn; deltaMs: number };
  const orphanCandidates: OrphanCandidate[] = [];
  for (const a of orphanTransfers) {
    for (const b of orphanTransfers) {
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
        `[transfer-pairing] ambiguous orphan match for a=${oc.a.id} b=${oc.b.id} — skipping`
      );
      ambiguousSkipped++;
      continue;
    }

    claimed.add(oc.a.id);
    claimed.add(oc.b.id);
    // Use lower id as "from" for determinism
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

  if (paired > 0 || ambiguousSkipped > 0) {
    console.log(`[transfer-pairing] done: paired=${paired} ambiguousSkipped=${ambiguousSkipped}`);
  }

  return { paired, ambiguousSkipped };
}
