import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, notFound, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { subscriptionShareUpdateSchema } from "@/lib/validation/subscription-share";

export const dynamic = "force-dynamic";

async function findShare(userId: string, id: string) {
  return db.subscriptionShare.findFirst({
    where: { id },
    include: { subscription: { select: { userId: true } } },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const share = await findShare(userId, id);
    if (!share || share.subscription.userId !== userId) {
      return notFound("subscription share not found");
    }

    const body = await parseBody(req, subscriptionShareUpdateSchema);
    if (!body.ok) return body.response;

    const updated = await db.subscriptionShare.update({
      where: { id },
      data: body.data,
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

// Hard delete
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const share = await findShare(userId, id);
    if (!share || share.subscription.userId !== userId) {
      return notFound("subscription share not found");
    }

    await db.subscriptionShare.delete({ where: { id } });
    return ok({ id });
  } catch (e) {
    return serverError(e);
  }
}
