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
    const acc = await db.account.findFirst({
      where: {
        id: input.accountId,
        userId: DEFAULT_USER_ID,
        deletedAt: null,
        isArchived: false,
      },
      select: { id: true },
    });
    if (!acc) return err("account not found or archived", 400);

    const includedRows = input.includedIndices.map((idx) => {
      const row = input.rows[idx];
      if (!row) throw new Error(`row index ${idx} out of range`);
      return { row, idx };
    });

    // Validate all referenced categories in one query instead of N round-trips
    // inside an interactive transaction (which used to time out at 5s on large
    // imports).
    const referencedCategoryIds = Array.from(
      new Set(
        Object.values(input.categoryMapping).filter(
          (v): v is string => typeof v === "string" && v.length > 0,
        ),
      ),
    );
    const validCategoryIds = referencedCategoryIds.length
      ? new Set(
          (
            await db.category.findMany({
              where: { id: { in: referencedCategoryIds }, userId: DEFAULT_USER_ID },
              select: { id: true },
            })
          ).map((c) => c.id),
        )
      : new Set<string>();

    const errors: Array<{ index: number; message: string }> = [];
    const toCreate: Prisma.TransactionCreateManyInput[] = [];

    for (const { row, idx } of includedRows) {
      const rawCategoryId = input.categoryMapping[String(idx)] ?? null;
      if (rawCategoryId && !validCategoryIds.has(rawCategoryId)) {
        errors.push({ index: idx, message: "category not found" });
        continue;
      }
      toCreate.push({
        userId: DEFAULT_USER_ID,
        accountId: input.accountId,
        categoryId: rawCategoryId || null,
        kind:
          row.kind === "INCOME"
            ? TransactionKind.INCOME
            : TransactionKind.EXPENSE,
        status: TransactionStatus.DONE,
        amount: row.amount,
        currencyCode: row.currencyCode,
        occurredAt: new Date(row.occurredAt),
        name: buildName(row.description, row.rawCategory, row.counterparty),
        note: row.externalId ? `import:${row.externalId}` : null,
      });
    }

    let created = 0;
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      const slice = toCreate.slice(i, i + CHUNK);
      const res = await db.transaction.createMany({ data: slice });
      created += res.count;
    }

    const skipped = includedRows.length - created;
    return ok({ created, skipped, errors });
  } catch (e) {
    return serverError(e);
  }
}

function buildName(
  description?: string,
  rawCategory?: string,
  counterparty?: string,
): string {
  // Pick best available label, truncate to 240 chars
  const candidates = [description, counterparty, rawCategory].filter(Boolean) as string[];
  const name = candidates[0] ?? "Import";
  return name.substring(0, 240);
}
