import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { err, notFound, ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { reimbUpdateSchema } from "@/lib/validation/reimbursement";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function findOwned(id: string) {
  return db.reimbursementFact.findFirst({
    where: { id, transaction: { userId: DEFAULT_USER_ID, deletedAt: null } },
  });
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const row = await findOwned(id);
    if (!row) return notFound("reimbursement not found");
    return ok(row);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await parseBody(req, reimbUpdateSchema);
  if (!body.ok) return body.response;
  const input = body.data;

  try {
    const existing = await findOwned(id);
    if (!existing) return notFound("reimbursement not found");

    if (input.accountId) {
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
    }

    const updated = await db.reimbursementFact.update({
      where: { id },
      data: {
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.receivedAt !== undefined ? { receivedAt: input.receivedAt } : {}),
        ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const existing = await findOwned(id);
    if (!existing) return notFound("reimbursement not found");
    await db.reimbursementFact.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (e) {
    return serverError(e);
  }
}
