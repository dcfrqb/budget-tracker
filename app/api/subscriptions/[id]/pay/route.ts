import { getCurrentUserId } from "@/lib/api/auth";
import { ok, err, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { subscriptionPaySchema } from "@/lib/validation/subscription";
import { paySubscription } from "@/lib/data/_mutations/subscriptions";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;

    const body = await parseBody(req, subscriptionPaySchema);
    if (!body.ok) return body.response;

    if (!body.data.accountId) {
      return err("account_id_required", 422);
    }

    try {
      const result = await paySubscription(userId, id, body.data);
      return ok(result, 201);
    } catch (payErr) {
      const msg = payErr instanceof Error ? payErr.message : String(payErr);
      if (msg === "subscription_not_found") return err(msg, 404);
      if (msg === "account_id_required") return err(msg, 422);
      throw payErr;
    }
  } catch (e) {
    return serverError(e);
  }
}
