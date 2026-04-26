import { getCurrentUserId } from "@/lib/api/auth";
import { ok, err, serverError } from "@/lib/api/response";
import { syncCredential } from "@/lib/data/_mutations/integrations";
import { syncBodySchema } from "@/lib/validation/integrations";

export const dynamic = "force-dynamic";

/**
 * POST /api/integrations/sync/:credentialId
 *
 * Triggers a sync for the given credential. Useful for cron jobs / webhooks.
 * Guarded by assertAdminIntegrations (called inside syncCredential).
 *
 * Optional JSON body: { accountId?: string, from?: string, to?: string }
 * Validated via syncBodySchema: max 90-day window, valid ISO datetime strings.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ credentialId: string }> },
) {
  try {
    const { credentialId } = await params;
    const userId = await getCurrentUserId();

    // Body is fully optional — treat missing / empty body as {}.
    let accountId: string | undefined;
    let range: { from: Date; to: Date } | undefined;

    const rawText = await req.text();
    if (rawText.trim()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        return err("invalid JSON body", 400);
      }

      const result = syncBodySchema.safeParse(parsed);
      if (!result.success) {
        return err("validation_failed", 400, {
          issues: result.error.issues.map((i) => i.path.join(".")),
        });
      }

      const body = result.data;
      if (body.accountId) accountId = body.accountId;
      if (body.from && body.to) {
        range = { from: new Date(body.from), to: new Date(body.to) };
      }
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
