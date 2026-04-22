import { Prisma, TransactionKind } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { conflict, err, ok, serverError } from "@/lib/api/response";
import { parseBody, parseWith } from "@/lib/api/validate";
import {
  transactionCreateSchema,
  transactionListQuerySchema,
} from "@/lib/validation/transaction";

export const dynamic = "force-dynamic";

function buildWhere(q: ReturnType<typeof transactionListQuerySchema.parse>) {
  const where: Prisma.TransactionWhereInput = {
    userId: DEFAULT_USER_ID,
    deletedAt: null,
  };
  if (q.from || q.to) {
    where.occurredAt = {};
    if (q.from) where.occurredAt.gte = q.from;
    if (q.to) where.occurredAt.lte = q.to;
  }
  if (q.kind && q.kind.length) where.kind = { in: q.kind };
  if (q.status && q.status.length) where.status = { in: q.status };
  if (q.accountId) where.accountId = q.accountId;
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.reimbursable !== undefined) where.isReimbursable = q.reimbursable;
  if (q.q) {
    where.OR = [
      { name: { contains: q.q, mode: "insensitive" } },
      { note: { contains: q.q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = parseWith(transactionListQuerySchema, params);
    if (!parsed.ok) return parsed.response;
    const q = parsed.data;

    const where = buildWhere(q);

    if (q.groupBy === "day") {
      // Группируем все подходящие по дню occurredAt. Пагинация не применяется —
      // UI рендерит все дни одним списком.
      const rows = await db.transaction.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        include: { account: true, category: true, reimbursements: true },
      });
      const byDay = new Map<string, typeof rows>();
      for (const t of rows) {
        const key = t.occurredAt.toISOString().slice(0, 10); // YYYY-MM-DD
        const list = byDay.get(key);
        if (list) list.push(t);
        else byDay.set(key, [t]);
      }
      const groups = [...byDay.entries()].map(([date, txns]) => ({ date, txns }));
      return ok(groups);
    }

    // Плоский список с cursor-based пагинацией.
    const rows = await db.transaction.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      include: { account: true, category: true },
    });
    const hasMore = rows.length > q.limit;
    const items = hasMore ? rows.slice(0, q.limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    return ok({ items, nextCursor });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const body = await parseBody(req, transactionCreateSchema);
  if (!body.ok) return body.response;
  const input = body.data;

  if (input.kind === TransactionKind.TRANSFER) {
    return conflict("use /api/transfers for TRANSFER kind");
  }

  try {
    // Проверка что accountId существует, не архивный, не удалён, принадлежит юзеру.
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

    if (input.categoryId) {
      const cat = await db.category.findFirst({
        where: { id: input.categoryId, userId: DEFAULT_USER_ID },
        select: { id: true },
      });
      if (!cat) return err("category not found", 400);
    }

    const created = await db.transaction.create({
      data: { ...input, userId: DEFAULT_USER_ID },
    });
    return ok(created, 201);
  } catch (e) {
    return serverError(e);
  }
}
