import { DEFAULT_USER_ID } from "@/lib/constants";
import { ok, err, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { importPreviewInputSchema } from "@/lib/validation/import";
import { parseTinkoff } from "@/lib/import/parsers/tinkoff";
import { parseGeneric } from "@/lib/import/parsers/generic";
import { findDuplicates } from "@/lib/import/dedupe";
import { suggestCategory } from "@/lib/import/categorize";
import { isTransferCategory } from "@/lib/import/categorize";
import { buildPairMap } from "@/lib/import/pair-match";
import type { PairCandidate } from "@/lib/import/pair-match";
import { db } from "@/lib/db";
import type { ImportPreviewRow, ImportPreview, ImportRow } from "@/lib/import/types";

export const dynamic = "force-dynamic";

type AccountInfo = {
  id: string;
  name: string;
  currencyCode: string;
  cardLast4: string[];
};

type AnnotatedRow = ImportRow & {
  accountId: string;
  sourceFile: string;
  isDuplicate: boolean;
  globalIndex: number; // index in the consolidated allRows array
};

export async function POST(req: Request) {
  const body = await parseBody(req, importPreviewInputSchema);
  if (!body.ok) return body.response;
  const input = body.data;

  try {
    // 1. Load all user accounts once
    const dbAccounts = await db.account.findMany({
      where: { userId: DEFAULT_USER_ID, deletedAt: null },
      select: { id: true, name: true, currencyCode: true, cardLast4: true },
    });

    const accountMap = new Map<string, AccountInfo>(
      dbAccounts.map((a) => [
        a.id,
        {
          id: a.id,
          name: a.name,
          currencyCode: a.currencyCode,
          cardLast4: a.cardLast4,
        },
      ]),
    );

    // 2. Validate every files[].accountId belongs to user
    for (const file of input.files) {
      if (!accountMap.has(file.accountId)) {
        return err(`account not found: ${file.accountId}`, 400);
      }
    }

    // 3. Load categories for suggestion (shared across all files)
    const dbCategories = await db.category.findMany({
      where: { userId: DEFAULT_USER_ID, archivedAt: null },
      select: { id: true, name: true, kind: true },
    });
    const categoriesForSuggest = dbCategories.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind as string,
    }));

    // 4. Load existing transactions for dedup (last 180 days)
    const since = new Date(Date.now() - 180 * 86400_000);
    const existingTxs = await db.transaction.findMany({
      where: {
        userId: DEFAULT_USER_ID,
        accountId: { in: input.files.map((f) => f.accountId) },
        deletedAt: null,
        occurredAt: { gte: since },
      },
      select: { occurredAt: true, amount: true, accountId: true },
    });

    // Group existing transactions by accountId for per-account dedup
    const existingByAccount = new Map<
      string,
      Array<{ occurredAt: Date; amount: string; accountId: string }>
    >();
    for (const tx of existingTxs) {
      const list = existingByAccount.get(tx.accountId);
      const entry = {
        occurredAt: tx.occurredAt,
        amount: tx.amount.toString(),
        accountId: tx.accountId,
      };
      if (list) {
        list.push(entry);
      } else {
        existingByAccount.set(tx.accountId, [entry]);
      }
    }

    // 5. Parse each file, deduplicate, annotate
    const allAnnotated: AnnotatedRow[] = [];
    const allWarnings: string[] = [];

    for (const file of input.files) {
      let parseResult: { rows: ImportRow[]; warnings: string[] };

      if (file.source === "tinkoff") {
        parseResult = parseTinkoff(file.csv, {
          delimiter: file.options?.delimiter,
          encoding: file.options?.encoding,
        });
      } else {
        const mapping = file.options?.mapping;
        if (!mapping) {
          // Prefix warning with filename
          allWarnings.push(`${file.filename}:mapping_required`);
          continue;
        }
        parseResult = parseGeneric(file.csv, { mapping });
      }

      // Prefix all file-level warnings with filename
      for (const w of parseResult.warnings) {
        allWarnings.push(`${file.filename}:${w}`);
      }

      const existing = existingByAccount.get(file.accountId) ?? [];
      const dupIndices = findDuplicates(parseResult.rows, existing, file.accountId);

      for (let i = 0; i < parseResult.rows.length; i++) {
        const row = parseResult.rows[i];
        allAnnotated.push({
          ...row,
          accountId: file.accountId,
          sourceFile: file.filename,
          isDuplicate: dupIndices.has(i),
          globalIndex: allAnnotated.length, // stable index in final consolidated array
        });
      }
    }

    // 6. Build pair candidates: rows that have a transfer category AND description
    //    matching "между своими счетами" (case-insensitive).
    const INTRA_DESC_RE = /между\s+своими\s+счетами/i;

    const pairCandidates: PairCandidate[] = [];
    const transferCandidateIndices = new Set<number>();

    for (const row of allAnnotated) {
      const isTransferCat = isTransferCategory(row.rawCategory);
      const isIntraDesc =
        row.description != null && INTRA_DESC_RE.test(row.description.trim());

      if (isTransferCat && isIntraDesc) {
        transferCandidateIndices.add(row.globalIndex);
        pairCandidates.push({
          index: row.globalIndex,
          accountId: row.accountId,
          amount: row.amount,
          currencyCode: row.currencyCode,
          occurredAt: row.occurredAt,
          direction: row.direction,
          cardLast4: row.cardLast4,
        });
      }
    }

    // 7. Pair-match
    const pairMap = buildPairMap(pairCandidates);

    // 8. Build final preview rows
    const previewRows: ImportPreviewRow[] = allAnnotated.map((row) => {
      const pairEntry = pairMap.get(row.globalIndex);
      const isTransferCandidate = transferCandidateIndices.has(row.globalIndex);

      // Compute pair fields
      let pairStatus: ImportPreviewRow["pairStatus"] = undefined;
      let pairId: string | undefined = undefined;
      let pairWith: number | undefined = undefined;

      if (pairEntry) {
        pairStatus = pairEntry.status;
        pairId = pairEntry.pairId;
        pairWith = pairEntry.partnerIndex;
      } else if (isTransferCandidate) {
        pairStatus = "unpaired";
      }

      // Intra-account-skipped rows should not be imported
      const includedByPair =
        pairEntry?.status === "intra-account-skipped" ? false : undefined;

      // Compute cardHint
      let cardHint: ImportPreviewRow["cardHint"] = undefined;
      if (row.cardLast4) {
        const targetAccount = accountMap.get(row.accountId);
        if (targetAccount && !targetAccount.cardLast4.includes(row.cardLast4)) {
          // This card is not registered on the target account — find which account has it
          let suggestedAccountId: string | undefined = undefined;
          for (const [acctId, acct] of accountMap) {
            if (acctId !== row.accountId && acct.cardLast4.includes(row.cardLast4)) {
              suggestedAccountId = acctId;
              break;
            }
          }
          cardHint = { last4: row.cardLast4, suggestedAccountId };
        }
      }

      const suggestedCategoryId = suggestCategory(row, categoriesForSuggest);

      const previewRow: ImportPreviewRow = {
        // Spread ImportRow fields
        externalId: row.externalId,
        occurredAt: row.occurredAt,
        amount: row.amount,
        currencyCode: row.currencyCode,
        kind: row.kind,
        direction: row.direction,
        cardLast4: row.cardLast4,
        rawCategory: row.rawCategory,
        description: row.description,
        counterparty: row.counterparty,
        raw: row.raw,
        // ImportPreviewRow fields
        accountId: row.accountId,
        sourceFile: row.sourceFile,
        suggestedCategoryId,
        selectedCategoryId: suggestedCategoryId ?? null,
        included: includedByPair !== undefined ? includedByPair : !row.isDuplicate,
        isDuplicate: row.isDuplicate,
        pairStatus,
        pairId,
        pairWith,
        cardHint,
      };

      return previewRow;
    });

    // 9. Sort by occurredAt descending
    previewRows.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    // 10. Compute stats
    let pairedTransferCount = 0;
    let intraSkippedCount = 0;
    let unpairedCount = 0;
    let totalDuplicates = 0;

    for (const row of previewRows) {
      if (row.isDuplicate) totalDuplicates++;
      if (row.pairStatus === "paired-transfer") pairedTransferCount++;
      if (row.pairStatus === "intra-account-skipped") intraSkippedCount++;
      if (row.pairStatus === "unpaired") unpairedCount++;
    }

    const preview: ImportPreview = {
      rows: previewRows,
      warnings: allWarnings,
      accounts: dbAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        currencyCode: a.currencyCode,
        cardLast4: a.cardLast4,
      })),
      stats: {
        total: previewRows.length,
        duplicates: totalDuplicates,
        paired: Math.floor(pairedTransferCount / 2),
        intraSkipped: Math.floor(intraSkippedCount / 2),
        unpaired: unpairedCount,
      },
    };

    return ok(preview);
  } catch (e) {
    return serverError(e);
  }
}
