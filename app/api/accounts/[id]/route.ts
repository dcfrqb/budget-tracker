import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { conflict, notFound, ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { accountUpdateSchema } from "@/lib/validation/account";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const acc = await db.account.findFirst({
      where: { id, userId: DEFAULT_USER_ID, deletedAt: null },
    });
    if (!acc) return notFound("account not found");
    return ok(acc);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await parseBody(req, accountUpdateSchema);
  if (!body.ok) return body.response;

  try {
    const existing = await db.account.findFirst({
      where: { id, userId: DEFAULT_USER_ID, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return notFound("account not found");

    const updated = await db.account.update({
      where: { id },
      data: body.data,
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const acc = await db.account.findFirst({
      where: { id, userId: DEFAULT_USER_ID, deletedAt: null },
      select: {
        id: true,
        _count: {
          select: {
            transactions: true,
            transfersFrom: true,
            transfersTo: true,
          },
        },
      },
    });
    if (!acc) return notFound("account not found");
    const related =
      acc._count.transactions + acc._count.transfersFrom + acc._count.transfersTo;
    if (related > 0) {
      return conflict(
        "account has transactions/transfers — archive instead of delete",
      );
    }

    await db.account.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (e) {
    return serverError(e);
  }
}
