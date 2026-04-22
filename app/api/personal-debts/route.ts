import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { err, ok, serverError } from "@/lib/api/response";
import { parseBody, parseWith } from "@/lib/api/validate";
import {
  apiDirectionToDb,
  dbDirectionToApi,
  debtCreateSchema,
  debtListQuerySchema,
} from "@/lib/validation/debt";
import {
  computeDebtProgress,
  getPersonalDebtsWithProgress,
  initialKindFor,
} from "@/lib/data/debts";

export const dynamic = "force-dynamic";

function serializeDebt(d: Awaited<ReturnType<typeof getPersonalDebtsWithProgress>>[number]) {
  return {
    ...d,
    direction: dbDirectionToApi(d.direction),
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = parseWith(
      debtListQuerySchema,
      Object.fromEntries(url.searchParams.entries()),
    );
    if (!parsed.ok) return parsed.response;

    const debts = await getPersonalDebtsWithProgress(DEFAULT_USER_ID, {
      direction: parsed.data.direction
        ? apiDirectionToDb(parsed.data.direction)
        : undefined,
      status: parsed.data.status,
    });
    return ok(debts.map(serializeDebt));
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const body = await parseBody(req, debtCreateSchema);
  if (!body.ok) return body.response;
  const input = body.data;
  const direction = apiDirectionToDb(input.direction);

  try {
    // Проверяем валюту и (если initialTransfer) аккаунт.
    const ccy = await db.currency.findUnique({
      where: { code: input.currencyCode },
      select: { code: true },
    });
    if (!ccy) return err("currency not found", 400);

    if (input.initialTransfer) {
      const acc = await db.account.findFirst({
        where: {
          id: input.initialTransfer.accountId,
          userId: DEFAULT_USER_ID,
          deletedAt: null,
          isArchived: false,
        },
        select: { id: true },
      });
      if (!acc) return err("account not found or archived", 400);
    }

    const result = await db.$transaction(async (tx) => {
      const debt = await tx.personalDebt.create({
        data: {
          userId: DEFAULT_USER_ID,
          direction,
          counterparty: input.counterparty,
          principal: input.principal,
          currencyCode: input.currencyCode,
          openedAt: input.openedAt,
          dueAt: input.dueAt ?? null,
          note: input.note ?? null,
        },
      });

      let initialTransaction = null;
      if (input.initialTransfer) {
        initialTransaction = await tx.transaction.create({
          data: {
            userId: DEFAULT_USER_ID,
            accountId: input.initialTransfer.accountId,
            kind: initialKindFor(direction),
            status: "DONE",
            amount: input.principal,
            currencyCode: input.currencyCode,
            occurredAt: input.initialTransfer.occurredAt ?? input.openedAt,
            name: `${direction === "LENT" ? "Выдача" : "Получение"} · ${input.counterparty}`,
            personalDebtId: debt.id,
          },
        });
      }

      // Progress на свежем объекте.
      const full = await tx.personalDebt.findUniqueOrThrow({
        where: { id: debt.id },
        include: {
          currency: true,
          transactions: {
            where: { deletedAt: null },
            include: { facts: true },
          },
        },
      });
      return { full, initialTransaction };
    });

    const withProgress = { ...result.full, ...computeDebtProgress(result.full) };
    return ok(
      {
        debt: serializeDebt(withProgress),
        initialTransaction: result.initialTransaction,
      },
      201,
    );
  } catch (e) {
    return serverError(e);
  }
}
