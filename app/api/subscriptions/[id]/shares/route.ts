import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, notFound, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { subscriptionShareCreateSchema } from "@/lib/validation/subscription-share";

export const dynamic = "force-dynamic";

async function findSub(userId: string, id: string) {
  return db.subscription.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const sub = await findSub(userId, id);
    if (!sub) return notFound("subscription not found");

    const shares = await db.subscriptionShare.findMany({
      where: { subscriptionId: id },
      orderBy: { createdAt: "asc" },
    });
    return ok(shares);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const sub = await findSub(userId, id);
    if (!sub) return notFound("subscription not found");

    const body = await parseBody(req, subscriptionShareCreateSchema);
    if (!body.ok) return body.response;

    const share = await db.subscriptionShare.create({
      data: { ...body.data, subscriptionId: id },
    });
    return ok(share, 201);
  } catch (e) {
    return serverError(e);
  }
}
