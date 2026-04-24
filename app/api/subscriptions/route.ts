import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { subscriptionCreateSchema } from "@/lib/validation/subscription";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const subs = await db.subscription.findMany({
      where: { userId, deletedAt: null },
      include: { shares: true, currency: true },
      orderBy: [{ sharingType: "asc" }, { nextPaymentDate: "asc" }],
    });
    return ok(subs);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const body = await parseBody(req, subscriptionCreateSchema);
    if (!body.ok) return body.response;

    const sub = await db.subscription.create({
      data: { ...body.data, userId },
      include: { shares: true, currency: true },
    });
    return ok(sub, 201);
  } catch (e) {
    return serverError(e);
  }
}
