import { Prisma } from "@prisma/client";
import { getCurrentUserId } from "@/lib/api/auth";
import { ok, err, serverError } from "@/lib/api/response";
import { parseWith } from "@/lib/api/validate";
import { hoursCalcQuerySchema } from "@/lib/validation/hours-calc";
import { getWorkSourceById, getPrimaryWorkSource } from "@/lib/data/work-sources";
import { getLatestRatesMap } from "@/lib/data/wallet";
import { computeHoursForAmount } from "@/lib/hours-calc";
import { DEFAULT_CURRENCY } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());

    const parsed = parseWith(hoursCalcQuerySchema, params);
    if (!parsed.ok) return parsed.response;
    const q = parsed.data;

    // Получаем WorkSource
    let workSource;
    if (q.workSourceId) {
      workSource = await getWorkSourceById(userId, q.workSourceId);
      if (!workSource) return err("work_source_not_found", 404);
    } else {
      workSource = await getPrimaryWorkSource(userId);
      if (!workSource) return err("no_active_work_source", 422);
    }

    const rates = await getLatestRatesMap();
    const amount = new Prisma.Decimal(q.amount);

    try {
      const result = computeHoursForAmount({
        amount,
        currencyCode: q.currencyCode,
        workSource,
        rates,
        baseCcy: DEFAULT_CURRENCY,
      });
      return ok({
        ...result,
        workSourceId: workSource.id,
        workSourceName: workSource.name,
        workSourceKind: workSource.kind,
        currencyCode: q.currencyCode,
        amount: q.amount,
      });
    } catch (calcErr) {
      const msg = calcErr instanceof Error ? calcErr.message : String(calcErr);
      return err(msg, 422);
    }
  } catch (e) {
    return serverError(e);
  }
}
