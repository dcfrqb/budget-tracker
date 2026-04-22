import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { conflict, notFound, ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { transactionUpdateSchema } from "@/lib/validation/transaction";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const DETAIL_INCLUDE = {
  account: true,
  category: true,
  currency: true,
  facts: { orderBy: { occurredAt: "desc" as const } },
  reimbursements: { orderBy: { receivedAt: "desc" as const } },
  transfer: {
    include: {
      fromAccount: true,
      toAccount: true,
    },
  },
  loan: true,
  loanPayment: true,
  subscription: true,
  longProject: true,
  fund: true,
  workSource: true,
  personalDebt: true,
  plannedEvent: true,
  family: true,
};

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const t = await db.transaction.findFirst({
      where: { id, userId: DEFAULT_USER_ID, deletedAt: null },
      include: DETAIL_INCLUDE,
    });
    if (!t) return notFound("transaction not found");
    return ok(t);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await parseBody(req, transactionUpdateSchema);
  if (!body.ok) return body.response;

  try {
    const existing = await db.transaction.findFirst({
      where: { id, userId: DEFAULT_USER_ID, deletedAt: null },
      select: { id: true, transferId: true },
    });
    if (!existing) return notFound("transaction not found");
    if (existing.transferId) {
      return conflict("transfer-side transaction — edit via /api/transfers");
    }

    const updated = await db.transaction.update({
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
    const existing = await db.transaction.findFirst({
      where: { id, userId: DEFAULT_USER_ID, deletedAt: null },
      select: { id: true, transferId: true },
    });
    if (!existing) return notFound("transaction not found");
    if (existing.transferId) {
      return conflict("transfer-side transaction — delete via /api/transfers/[id]");
    }

    await db.transaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return new Response(null, { status: 204 });
  } catch (e) {
    return serverError(e);
  }
}
