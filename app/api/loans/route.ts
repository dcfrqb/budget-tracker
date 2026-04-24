import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { loanCreateSchema } from "@/lib/validation/loan";
import { getLoans } from "@/lib/data/loans";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const loans = await getLoans(userId);
    return ok(loans);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const body = await parseBody(req, loanCreateSchema);
    if (!body.ok) return body.response;

    const loan = await db.loan.create({
      data: { ...body.data, userId },
    });
    return ok(loan, 201);
  } catch (e) {
    return serverError(e);
  }
}
