import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, notFound, err, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { fundContributionSchema } from "@/lib/validation/fund-contribution";
import { getFundById } from "@/lib/data/funds";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const fund = await getFundById(userId, id);
    if (!fund) return notFound("fund not found");

    const body = await parseBody(req, fundContributionSchema);
    if (!body.ok) return body.response;
    const input = body.data;

    // Проверяем совпадение валют
    if (input.currencyCode !== fund.currencyCode) {
      return err("currency_mismatch", 422, {
        expected: fund.currencyCode,
        got: input.currencyCode,
      });
    }

    // Проверяем account
    const account = await db.account.findFirst({
      where: { id: input.accountId, userId, deletedAt: null, isArchived: false },
      select: { id: true },
    });
    if (!account) return err("account not found or archived", 400);

    const amount = new Prisma.Decimal(input.amount);
    const occurredAt = input.occurredAt ?? new Date();

    const result = await db.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: input.accountId,
          kind: "EXPENSE",
          status: "DONE",
          amount,
          currencyCode: input.currencyCode,
          occurredAt,
          name: `Взнос: ${fund.name}`,
          fundId: id,
        },
      });

      const updated = await tx.fund.update({
        where: { id },
        data: {
          currentAmount: {
            increment: amount,
          },
        },
      });

      return { fund: updated, transactionId: transaction.id };
    });

    return ok(result, 201);
  } catch (e) {
    return serverError(e);
  }
}
