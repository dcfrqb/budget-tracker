import { getCurrentUserId } from "@/lib/api/auth";
import { ok, err, serverError } from "@/lib/api/response";
import { syncCredential } from "@/lib/data/_mutations/integrations";

export const dynamic = "force-dynamic";

/**
 * POST /api/integrations/sync/:credentialId
 *
 * Triggers a sync for the given credential. Useful for cron jobs / webhooks.
 * Guarded by assertAdminIntegrations (called inside syncCredential).
 *
 * Optional JSON body: { accountId?: string, from?: string, to?: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ credentialId: string }> },
) {
  try {
    const { credentialId } = await params;
    const userId = await getCurrentUserId();

    let accountId: string | undefined;
    let range: { from: Date; to: Date } | undefined;

    try {
      const body = await req.json().catch(() => ({}));
      if (body && typeof body === "object") {
        if (typeof body.accountId === "string") accountId = body.accountId;
        if (typeof body.from === "string" && typeof body.to === "string") {
          const from = new Date(body.from);
          const to = new Date(body.to);
          if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
            range = { from, to };
          }
        }
      }
    } catch {
      // ignore body parse errors — all fields optional
    }

    const result = await syncCredential(userId, credentialId, {
      range,
      accountId,
    });

    return ok(result);
  } catch (e) {
    if (e instanceof Error && "code" in e) {
      const code = (e as { code: string }).code;
      if (code === "FORBIDDEN") return err(e.message, 403);
      if (code === "NOT_FOUND") return err(e.message, 404);
      if (code === "CONFLICT") return err(e.message, 409);
    }
    return serverError(e);
  }
}
