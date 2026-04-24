import { DEFAULT_USER_ID } from "@/lib/constants";
import { ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { importPreviewInputSchema } from "@/lib/validation/import";
import { parseTinkoff } from "@/lib/import/parsers/tinkoff";
import { parseGeneric } from "@/lib/import/parsers/generic";
import { findDuplicates } from "@/lib/import/dedupe";
import { suggestCategory } from "@/lib/import/categorize";
import { db } from "@/lib/db";
import type { ImportPreviewRow, ImportPreview } from "@/lib/import/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await parseBody(req, importPreviewInputSchema);
  if (!body.ok) return body.response;
  const input = body.data;

  try {
    // Parse CSV based on source
    let parseResult: { rows: ReturnType<typeof parseTinkoff>["rows"]; warnings: string[] };

    if (input.source === "tinkoff") {
      parseResult = parseTinkoff(input.csv, {
        delimiter: input.options?.delimiter,
        encoding: input.options?.encoding,
      });
    } else {
      const mapping = input.options?.mapping;
      if (!mapping) {
        return ok({ rows: [], warnings: ["mapping_required"], stats: { total: 0, duplicates: 0 } } satisfies ImportPreview);
      }
      parseResult = parseGeneric(input.csv, { mapping });
    }

    const { rows, warnings } = parseResult;

    // Load existing transactions for dedup (last 180 days)
    const since = new Date(Date.now() - 180 * 86400_000);
    const existing = await db.transaction.findMany({
      where: {
        userId: DEFAULT_USER_ID,
        accountId: input.accountId,
        deletedAt: null,
        occurredAt: { gte: since },
      },
      select: {
        occurredAt: true,
        amount: true,
        accountId: true,
      },
    });

    const existingForDedup = existing.map((tx) => ({
      occurredAt: tx.occurredAt,
      amount: tx.amount.toString(),
      accountId: tx.accountId,
    }));

    const duplicateIndices = findDuplicates(rows, existingForDedup, input.accountId);

    // Load categories for suggestion
    const categories = await db.category.findMany({
      where: { userId: DEFAULT_USER_ID, archivedAt: null },
      select: { id: true, name: true, kind: true },
    });

    const categoriesForSuggest = categories.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind as string,
    }));

    // Build preview rows
    const previewRows: ImportPreviewRow[] = rows.map((row, i) => {
      const isDuplicate = duplicateIndices.has(i);
      const suggestedCategoryId = suggestCategory(row, categoriesForSuggest);

      return {
        ...row,
        suggestedCategoryId,
        selectedCategoryId: suggestedCategoryId ?? null,
        included: !isDuplicate,
        isDuplicate,
      };
    });

    const preview: ImportPreview = {
      rows: previewRows,
      warnings,
      stats: {
        total: rows.length,
        duplicates: duplicateIndices.size,
      },
    };

    return ok(preview);
  } catch (e) {
    return serverError(e);
  }
}
