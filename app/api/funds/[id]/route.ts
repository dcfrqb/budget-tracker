import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, notFound, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { fundUpdateSchema } from "@/lib/validation/fund";
import { getFundById } from "@/lib/data/funds";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const fund = await getFundById(userId, id);
    if (!fund) return notFound("fund not found");

    const goal = new Prisma.Decimal(fund.goalAmount);
    const current = new Prisma.Decimal(fund.currentAmount);
    const progressPct = goal.isZero() ? 0 : current.div(goal).times(100).toNumber();
    const remainingAmount = goal.minus(current);

    return ok({ ...fund, progressPct, remainingAmount });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const existing = await getFundById(userId, id);
    if (!existing) return notFound("fund not found");

    const body = await parseBody(req, fundUpdateSchema);
    if (!body.ok) return body.response;

    const updated = await db.fund.update({
      where: { id },
      data: body.data,
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const existing = await getFundById(userId, id);
    if (!existing) return notFound("fund not found");

    await db.fund.delete({ where: { id } });
    return ok({ id });
  } catch (e) {
    return serverError(e);
  }
}
