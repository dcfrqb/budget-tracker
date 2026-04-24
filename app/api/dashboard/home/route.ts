import { getCurrentUserId } from "@/lib/api/auth";
import { ok, serverError } from "@/lib/api/response";
import { getHomeDashboard } from "@/lib/data/dashboard";
import { db } from "@/lib/db";
import { DEFAULT_CURRENCY } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(req.url);

    // baseCcy: query param → BudgetSettings.primaryCurrencyCode → DEFAULT_CURRENCY
    let baseCcy = searchParams.get("baseCcy")?.toUpperCase() ?? null;
    if (!baseCcy) {
      const settings = await db.budgetSettings.findUnique({ where: { userId } });
      baseCcy = settings?.primaryCurrencyCode ?? DEFAULT_CURRENCY;
    }

    const dashboard = await getHomeDashboard(userId, baseCcy);
    return ok(dashboard);
  } catch (e) {
    return serverError(e);
  }
}
