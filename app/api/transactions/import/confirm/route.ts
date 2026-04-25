import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { ok, err, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { importConfirmInputSchema } from "@/lib/validation/import";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Postgres has a hard cap on parameters per statement (~65535). Each row binds
// ~11 params, so 2000 rows per chunk keeps us well under the limit and also
// bounds memory / time per statement for very large imports.
const CHUNK = 2000;

export async function POST(req: Request) {
  const body = await parseBody(req, importConfirmInputSchema);
  if (!body.ok) return body.response;
  const input = body.data;

  try {
    // ── 1. Collect included rows (filter intra-account-skipped defensively) ──
    const includedRows = input.includedIndices
      .map((idx) => {
        const row = input.rows[idx];
        if (!row) throw new Error(`row index ${idx} out of range`);
        return { row, idx };
      })
      .filter(({ row }) => row.pairStatus !== "intra-account-skipped");

    // ── 2. Validate all referenced account IDs are owned & active ───────────
    const distinctAccountIds = Array.from(
      new Set(includedRows.map(({ row }) => row.accountId)),
    );

    const ownedAccounts = await db.account.findMany({
      where: {
        id: { in: distinctAccountIds },
        userId: DEFAULT_USER_ID,
        deletedAt: null,
        isArchived: false,
      },
      select: { id: true, currencyCode: true },
    });

    const ownedAccountMap = new Map(ownedAccounts.map((a) => [a.id, a]));

    const missingAccountId = distinctAccountIds.find(
      (id) => !ownedAccountMap.has(id),
    );
    if (missingAccountId) {
      return err(`account not found or archived: ${missingAccountId}`, 400);
    }

    // ── 3. Validate categories (only for non-TRANSFER rows) ─────────────────
    // Prefer per-row selectedCategoryId; fall back to legacy categoryMapping.
    const referencedCategoryIds = Array.from(
      new Set(
        includedRows
          .filter(({ row }) => row.kind !== "TRANSFER")
          .map(({ row, idx }) => {
            const catId =
              row.selectedCategoryId ??
              input.categoryMapping?.[String(idx)] ??
              null;
            return catId;
          })
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      ),
    );

    const validCategoryIds = referencedCategoryIds.length
      ? new Set(
          (
            await db.category.findMany({
              where: {
                id: { in: referencedCategoryIds },
                userId: DEFAULT_USER_ID,
              },
              select: { id: true },
            })
          ).map((c) => c.id),
        )
      : new Set<string>();

    // ── 4. Group rows by pairId for paired-transfer detection ───────────────
    // Map: pairId → array of { row, idx }
    const pairGroups = new Map<
      string,
      Array<{ row: (typeof includedRows)[number]["row"]; idx: number }>
    >();
    const unpaired: typeof includedRows = [];

    for (const entry of includedRows) {
      const { row } = entry;
      if (row.pairStatus === "paired-transfer" && row.pairId) {
        const group = pairGroups.get(row.pairId) ?? [];
        group.push(entry);
        pairGroups.set(row.pairId, group);
      } else {
        unpaired.push(entry);
      }
    }

    // ── 5. Prepare DB writes ─────────────────────────────────────────────────
    const errors: Array<{ rowIndex: number; code: string; message?: string }> =
      [];

    // Transactions to batch-create (non-transfer plain rows)
    const toCreateMany: Prisma.TransactionCreateManyInput[] = [];

    // Transfer pairs to create one-by-one inside tx
    type TransferPairData = {
      fromAccountId: string;
      toAccountId: string;
      fromAmount: Prisma.Decimal;
      toAmount: Prisma.Decimal;
      fromCcy: string;
      toCcy: string;
      occurredAt: Date;
      outRow: (typeof includedRows)[number]["row"];
      outIdx: number;
      inRow: (typeof includedRows)[number]["row"];
      inIdx: number;
    };
    const transferPairs: TransferPairData[] = [];

    let skipped = 0;

    // Process paired groups
    for (const [, legs] of pairGroups) {
      if (legs.length !== 2) {
        // Incomplete pair (only one leg included) — import each leg individually
        for (const entry of legs) {
          const plain = buildPlainTransaction(
            entry.row,
            entry.idx,
            input.categoryMapping,
            validCategoryIds,
            errors,
          );
          if (plain) toCreateMany.push(plain);
        }
        continue;
      }

      const [a, b] = legs as [
        (typeof includedRows)[number],
        (typeof includedRows)[number],
      ];
      const outEntry = a.row.direction === "out" ? a : b;
      const inEntry = a.row.direction === "in" ? a : b;

      // Both same direction — data error, import as plain
      if (outEntry.row.direction === inEntry.row.direction) {
        for (const entry of [outEntry, inEntry]) {
          const plain = buildPlainTransaction(
            entry.row,
            entry.idx,
            input.categoryMapping,
            validCategoryIds,
            errors,
          );
          if (plain) toCreateMany.push(plain);
        }
        continue;
      }

      // Both same account — shouldn't reach here (upstream marks intra-skipped) but defend
      if (outEntry.row.accountId === inEntry.row.accountId) {
        continue;
      }

      const fromAcc = ownedAccountMap.get(outEntry.row.accountId)!;
      const toAcc = ownedAccountMap.get(inEntry.row.accountId)!;

      transferPairs.push({
        fromAccountId: outEntry.row.accountId,
        toAccountId: inEntry.row.accountId,
        fromAmount: new Prisma.Decimal(outEntry.row.amount),
        toAmount: new Prisma.Decimal(inEntry.row.amount),
        fromCcy: outEntry.row.currencyCode || fromAcc.currencyCode,
        toCcy: inEntry.row.currencyCode || toAcc.currencyCode,
        occurredAt: new Date(outEntry.row.occurredAt),
        outRow: outEntry.row,
        outIdx: outEntry.idx,
        inRow: inEntry.row,
        inIdx: inEntry.idx,
      });
    }

    // Process non-paired rows
    for (const { row, idx } of unpaired) {
      // Unpaired TRANSFER rows: import as INCOME/EXPENSE based on direction
      if (row.kind === "TRANSFER") {
        const kind =
          row.direction === "in" ? TransactionKind.INCOME : TransactionKind.EXPENSE;
        const rawCategoryId =
          row.selectedCategoryId ?? input.categoryMapping?.[String(idx)] ?? null;
        const categoryId =
          rawCategoryId && validCategoryIds.has(rawCategoryId)
            ? rawCategoryId
            : null;
        toCreateMany.push({
          userId: DEFAULT_USER_ID,
          accountId: row.accountId,
          categoryId,
          kind,
          status: TransactionStatus.DONE,
          amount: row.amount,
          currencyCode: row.currencyCode,
          occurredAt: new Date(row.occurredAt),
          name: buildName(row.description, row.rawCategory, row.counterparty),
          note: row.externalId ? `import:${row.externalId}` : null,
        });
        continue;
      }

      const plain = buildPlainTransaction(
        row,
        idx,
        input.categoryMapping,
        validCategoryIds,
        errors,
      );
      if (plain) toCreateMany.push(plain);
    }

    // ── 6. Execute all writes in a single Prisma transaction ────────────────
    let created = 0;
    let transfersCreated = 0;

    await db.$transaction(
      async (tx) => {
        // Create paired transfers
        for (const pair of transferPairs) {
          const fromCcy = pair.fromCcy;
          const toCcy = pair.toCcy;
          const rate =
            fromCcy === toCcy
              ? new Prisma.Decimal(1)
              : pair.toAmount.div(pair.fromAmount);

          const transfer = await tx.transfer.create({
            data: {
              userId: DEFAULT_USER_ID,
              fromAccountId: pair.fromAccountId,
              toAccountId: pair.toAccountId,
              fromAmount: pair.fromAmount,
              toAmount: pair.toAmount,
              fromCcy,
              toCcy,
              rate,
              occurredAt: pair.occurredAt,
            },
            select: { id: true },
          });

          // Create two TRANSFER transactions linked to the Transfer entity
          await tx.transaction.createMany({
            data: [
              {
                userId: DEFAULT_USER_ID,
                accountId: pair.fromAccountId,
                categoryId: null,
                kind: TransactionKind.TRANSFER,
                status: TransactionStatus.DONE,
                amount: pair.fromAmount,
                currencyCode: pair.fromCcy,
                occurredAt: pair.occurredAt,
                name: buildName(
                  pair.outRow.description,
                  pair.outRow.rawCategory,
                  pair.outRow.counterparty,
                ) || "Между своими счетами",
                note: pair.outRow.externalId
                  ? `import:${pair.outRow.externalId}`
                  : null,
                transferId: transfer.id,
              },
              {
                userId: DEFAULT_USER_ID,
                accountId: pair.toAccountId,
                categoryId: null,
                kind: TransactionKind.TRANSFER,
                status: TransactionStatus.DONE,
                amount: pair.toAmount,
                currencyCode: pair.toCcy,
                occurredAt: pair.occurredAt,
                name: buildName(
                  pair.inRow.description,
                  pair.inRow.rawCategory,
                  pair.inRow.counterparty,
                ) || "Между своими счетами",
                note: pair.inRow.externalId
                  ? `import:${pair.inRow.externalId}`
                  : null,
                transferId: transfer.id,
              },
            ],
          });

          created += 2;
          transfersCreated += 1;
        }

        // Batch-create plain transactions in chunks
        for (let i = 0; i < toCreateMany.length; i += CHUNK) {
          const slice = toCreateMany.slice(i, i + CHUNK);
          const res = await tx.transaction.createMany({ data: slice });
          created += res.count;
        }
      },
      { maxWait: 5_000, timeout: 60_000 },
    );

    skipped += includedRows.length - created - errors.length;

    return ok({ created, skipped, transfersCreated, errors });
  } catch (e) {
    return serverError(e);
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function buildPlainTransaction(
  row: {
    kind: "INCOME" | "EXPENSE" | "TRANSFER";
    direction: "in" | "out";
    accountId: string;
    amount: string;
    currencyCode: string;
    occurredAt: string;
    description?: string;
    rawCategory?: string;
    counterparty?: string;
    externalId?: string;
    selectedCategoryId?: string | null;
  },
  idx: number,
  categoryMapping: Record<string, string | null> | undefined,
  validCategoryIds: Set<string>,
  errors: Array<{ rowIndex: number; code: string; message?: string }>,
): Prisma.TransactionCreateManyInput | null {
  const rawCategoryId =
    row.selectedCategoryId ?? categoryMapping?.[String(idx)] ?? null;

  if (rawCategoryId && !validCategoryIds.has(rawCategoryId)) {
    errors.push({ rowIndex: idx, code: "category_not_found" });
    return null;
  }

  const isTransfer = row.kind === "TRANSFER";
  const kind =
    row.kind === "INCOME"
      ? TransactionKind.INCOME
      : row.kind === "TRANSFER"
        ? row.direction === "in"
          ? TransactionKind.INCOME
          : TransactionKind.EXPENSE
        : TransactionKind.EXPENSE;

  return {
    userId: DEFAULT_USER_ID,
    accountId: row.accountId,
    categoryId: isTransfer ? null : (rawCategoryId || null),
    kind,
    status: TransactionStatus.DONE,
    amount: row.amount,
    currencyCode: row.currencyCode,
    occurredAt: new Date(row.occurredAt),
    name: buildName(row.description, row.rawCategory, row.counterparty),
    note: row.externalId ? `import:${row.externalId}` : null,
  };
}

function buildName(
  description?: string,
  rawCategory?: string,
  counterparty?: string,
): string {
  // Pick best available label, truncate to 240 chars
  const candidates = [description, counterparty, rawCategory].filter(
    Boolean,
  ) as string[];
  const name = candidates[0] ?? "Import";
  return name.substring(0, 240);
}
