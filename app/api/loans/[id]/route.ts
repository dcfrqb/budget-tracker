import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, notFound, conflict, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { loanUpdateSchema } from "@/lib/validation/loan";
import { getLoanById, computeLoanProgress } from "@/lib/data/loans";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const loan = await getLoanById(userId, id);
    if (!loan) return notFound("loan not found");

    const progress = computeLoanProgress(loan, loan.payments);
    return ok({ ...loan, progress });
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
    const loan = await getLoanById(userId, id);
    if (!loan) return notFound("loan not found");

    const body = await parseBody(req, loanUpdateSchema);
    if (!body.ok) return body.response;

    const updated = await db.loan.update({
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
    const loan = await getLoanById(userId, id);
    if (!loan) return notFound("loan not found");

    if (loan._count.payments > 0) {
      return conflict("cannot delete loan with existing payments");
    }

    await db.loan.delete({ where: { id } });
    return ok({ id });
  } catch (e) {
    return serverError(e);
  }
}
