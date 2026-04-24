import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { fundCreateSchema } from "@/lib/validation/fund";
import { getFundsWithProgress } from "@/lib/data/funds";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const funds = await getFundsWithProgress(userId);
    return ok(funds);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const body = await parseBody(req, fundCreateSchema);
    if (!body.ok) return body.response;

    const fund = await db.fund.create({
      data: { ...body.data, userId },
    });
    return ok(fund, 201);
  } catch (e) {
    return serverError(e);
  }
}
