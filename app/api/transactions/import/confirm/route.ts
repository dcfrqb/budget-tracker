import { TransactionKind, TransactionStatus } from "@prisma/client";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { ok, err, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { importConfirmInputSchema } from "@/lib/validation/import";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await parseBody(req, importConfirmInputSchema);
  if (!body.ok) return body.response;
  const input = body.data;

  try {
    // Verify account belongs to user
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

    const errors: Array<{ index: number; message: string }> = [];
    let created = 0;
    let skipped = 0;

    // Bulk create in a single prisma transaction
    await db.$transaction(async (tx) => {
      for (const { row, idx } of includedRows) {
        try {
          const categoryId = input.categoryMapping[String(idx)] ?? null;

          // Validate category if provided
          if (categoryId) {
            const cat = await tx.category.findFirst({
              where: { id: categoryId, userId: DEFAULT_USER_ID },
              select: { id: true },
            });
            if (!cat) {
              errors.push({ index: idx, message: "category not found" });
              skipped++;
              continue;
            }
          }

          const kind =
            row.kind === "INCOME"
              ? TransactionKind.INCOME
              : TransactionKind.EXPENSE;

          await tx.transaction.create({
            data: {
              userId: DEFAULT_USER_ID,
              accountId: input.accountId,
              categoryId: categoryId || null,
              kind,
              status: TransactionStatus.DONE,
              amount: row.amount,
              currencyCode: row.currencyCode,
              occurredAt: new Date(row.occurredAt),
              name: buildName(row.description, row.rawCategory, row.counterparty),
              note: row.externalId ? `import:${row.externalId}` : null,
            },
          });
          created++;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          errors.push({ index: idx, message });
          skipped++;
        }
      }
    });

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
