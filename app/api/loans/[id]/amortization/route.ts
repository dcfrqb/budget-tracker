import { Prisma } from "@prisma/client";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, notFound, serverError } from "@/lib/api/response";
import { getLoanById } from "@/lib/data/loans";
import { computeAmortization } from "@/lib/amortization";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const loan = await getLoanById(userId, id);
    if (!loan) return notFound("loan not found");

    const url = new URL(req.url);
    const fromStr = url.searchParams.get("from");
    const toStr = url.searchParams.get("to");

    const schedule = computeAmortization({
      principal: new Prisma.Decimal(loan.principal),
      annualRatePct: new Prisma.Decimal(loan.annualRatePct),
      termMonths: loan.termMonths,
      startDate: loan.startDate,
    });

    const filtered = schedule.filter((row) => {
      if (fromStr && row.date < new Date(fromStr)) return false;
      if (toStr && row.date > new Date(toStr)) return false;
      return true;
    });

    return ok(filtered);
  } catch (e) {
    return serverError(e);
  }
}
