import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, serverError } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validate";
import { budgetSettingsUpdateSchema } from "@/lib/validation/budget-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    const settings = await db.budgetSettings.upsert({
      where: { userId },
      create: {
        userId,
        activeMode: "NORMAL",
        primaryCurrencyCode: "RUB",
      },
      update: {},
    });
    return ok(settings);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const body = await parseBody(req, budgetSettingsUpdateSchema);
    if (!body.ok) return body.response;

    const updated = await db.budgetSettings.upsert({
      where: { userId },
      create: {
        userId,
        activeMode: body.data.activeMode ?? "NORMAL",
        primaryCurrencyCode: body.data.primaryCurrencyCode ?? "RUB",
      },
      update: body.data,
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
