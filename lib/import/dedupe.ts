import type { ImportRow } from "./types";

export type ExistingTransaction = {
  externalId?: string | null;
  occurredAt: Date;
  amount: string;
  accountId: string;
};

/**
 * Finds duplicate rows among import candidates by comparing against existing transactions.
 *
 * Duplicate detection logic:
 * 1. If both have externalId — exact match.
 * 2. Otherwise — same accountId + same amount + occurredAt within ±60 seconds.
 *
 * Returns a Set of row indices (0-based) that are likely duplicates.
 */
export function findDuplicates(
  rows: ImportRow[],
  existingTransactions: ExistingTransaction[],
  accountId: string,
): Set<number> {
  const duplicateIndices = new Set<number>();

  // Build lookup sets for fast matching
  const externalIdSet = new Set<string>();
  const fuzzyKeys = new Set<string>();

  for (const tx of existingTransactions) {
    if (tx.externalId) {
      externalIdSet.add(tx.externalId);
    }
    // Fuzzy key: accountId + amount + minute-level timestamp bucket
    const bucket = Math.floor(tx.occurredAt.getTime() / 60_000);
    fuzzyKeys.add(`${accountId}:${tx.amount}:${bucket}`);
    // Also add adjacent buckets for ±60s tolerance
    fuzzyKeys.add(`${accountId}:${tx.amount}:${bucket - 1}`);
    fuzzyKeys.add(`${accountId}:${tx.amount}:${bucket + 1}`);
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // 1. External ID match
    if (row.externalId && externalIdSet.has(row.externalId)) {
      duplicateIndices.add(i);
      continue;
    }

    // 2. Fuzzy match: same amount + time within ±60s
    const rowDate = new Date(row.occurredAt);
    if (!isNaN(rowDate.getTime())) {
      const bucket = Math.floor(rowDate.getTime() / 60_000);
      if (fuzzyKeys.has(`${accountId}:${row.amount}:${bucket}`)) {
        duplicateIndices.add(i);
      }
    }
  }

  return duplicateIndices;
}
