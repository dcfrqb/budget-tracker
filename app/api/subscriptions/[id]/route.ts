import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, notFound, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { subscriptionUpdateSchema } from "@/lib/validation/subscription";

export const dynamic = "force-dynamic";

async function findSub(userId: string, id: string) {
  return db.subscription.findFirst({
    where: { id, userId, deletedAt: null },
    include: { shares: true, currency: true },
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
    return ok(sub);
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
    const existing = await findSub(userId, id);
    if (!existing) return notFound("subscription not found");

    const body = await parseBody(req, subscriptionUpdateSchema);
    if (!body.ok) return body.response;

    const updated = await db.subscription.update({
      where: { id },
      data: body.data,
      include: { shares: true, currency: true },
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

// Soft delete
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const existing = await findSub(userId, id);
    if (!existing) return notFound("subscription not found");

    await db.subscription.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return ok({ id });
  } catch (e) {
    return serverError(e);
  }
}
