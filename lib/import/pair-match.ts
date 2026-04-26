/**
 * Transfer pair-matching for multi-file CSV import.
 *
 * Matches "out" legs against "in" legs by amount + currency + timestamp proximity
 * (within ±10 seconds). A pair represents money moving between two accounts —
 * both rows should be imported as a TRANSFER transaction, not income/expense.
 *
 * Pure function — no DB, no side effects.
 */

export type PairCandidate = {
  index: number;
  accountId: string;
  amount: string;         // abs decimal string, e.g. "5000.00"
  currencyCode: string;
  occurredAt: string;     // ISO datetime string
  direction: "in" | "out";
  cardLast4?: string;
};

export type PairResult = Map<
  number,
  {
    partnerIndex: number;
    pairId: string;
    status: "paired-transfer" | "intra-account-skipped";
  }
>;

const PAIR_WINDOW_MS = 60_000; // ±60 seconds — bank CSV exports can have up to ~1 min skew between legs

/**
 * Builds a map from candidate index → pair metadata for all matched pairs.
 * Unmatched candidates are absent from the map (caller treats them as "unpaired").
 */
export function buildPairMap(candidates: PairCandidate[]): PairResult {
  const result: PairResult = new Map();

  // Bucket by "amount:currencyCode"
  const buckets = new Map<string, PairCandidate[]>();
  for (const c of candidates) {
    const key = `${c.amount}:${c.currencyCode}`;
    const list = buckets.get(key);
    if (list) {
      list.push(c);
    } else {
      buckets.set(key, [c]);
    }
  }

  let globalSeq = 0;

  for (const [bucketKey, members] of buckets) {
    const outs = members
      .filter((c) => c.direction === "out")
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)); // descending

    const ins = members
      .filter((c) => c.direction === "in")
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)); // ascending

    // Track which "in" candidates have already been claimed
    const claimedIn = new Set<number>();

    // For each "out" (descending by timestamp), find the closest unmatched "in"
    // within ±PAIR_WINDOW_MS
    for (const outC of outs) {
      if (result.has(outC.index)) continue; // already matched (shouldn't happen)

      const outTs = new Date(outC.occurredAt).getTime();
      if (isNaN(outTs)) continue;

      let bestIn: PairCandidate | null = null;
      let bestDiff = Infinity;

      for (const inC of ins) {
        if (claimedIn.has(inC.index)) continue;
        const inTs = new Date(inC.occurredAt).getTime();
        if (isNaN(inTs)) continue;
        const diff = Math.abs(outTs - inTs);
        if (diff <= PAIR_WINDOW_MS && diff < bestDiff) {
          bestDiff = diff;
          bestIn = inC;
        }
      }

      if (!bestIn) continue;

      // Found a pair
      claimedIn.add(bestIn.index);
      globalSeq += 1;

      const earlierOccurredAt =
        outC.occurredAt < bestIn.occurredAt ? outC.occurredAt : bestIn.occurredAt;
      const pairId = `pair:${bucketKey}:${earlierOccurredAt}:${globalSeq}`;

      const status: "paired-transfer" | "intra-account-skipped" =
        outC.accountId === bestIn.accountId
          ? "intra-account-skipped"
          : "paired-transfer";

      result.set(outC.index, {
        partnerIndex: bestIn.index,
        pairId,
        status,
      });
      result.set(bestIn.index, {
        partnerIndex: outC.index,
        pairId,
        status,
      });
    }
  }

  return result;
}
