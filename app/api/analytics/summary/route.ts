import { getCurrentUserId } from "@/lib/api/auth";
import { getCurrentUserTz } from "@/lib/data/_users/get-user-tz";
import { ok, serverError } from "@/lib/api/response";
import { parseWith } from "@/lib/api/validate";
import { analyticsQuerySchema } from "@/lib/validation/analytics";
import {
  resolveAnalyticsRange,
  getPeriodKpis,
  getCategoryPie,
  getPeriodCompare,
  getTrendPoints,
  getWeather,
  getForecastMonth,
} from "@/lib/data/analytics";
import { getHomeDashboard } from "@/lib/data/dashboard";
import { toAnalyticsView } from "@/lib/view/analytics";
import { getBudgetSettings } from "@/lib/data/settings";
import { DEFAULT_CURRENCY } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const [userId, tz] = await Promise.all([getCurrentUserId(), getCurrentUserTz()]);
    const { searchParams } = new URL(req.url);

    const queryResult = parseWith(analyticsQuerySchema, {
      period: searchParams.get("period") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      baseCcy: searchParams.get("baseCcy") ?? undefined,
    });

    if (!queryResult.ok) return queryResult.response;

    const { period, from, to } = queryResult.data;

    // baseCcy: query param → BudgetSettings → DEFAULT_CURRENCY
    let baseCcy = queryResult.data.baseCcy?.toUpperCase() ?? null;
    if (!baseCcy) {
      const settings = await getBudgetSettings(userId);
      baseCcy = settings?.primaryCurrencyCode ?? DEFAULT_CURRENCY;
    }

    const range = resolveAnalyticsRange(period, tz, from, to);

    // Granularity: month-level calendar periods or '1m' rolling → weekly, otherwise monthly
    const granularity = (period === "1m" || period.startsWith("m")) ? "weekly" as const : "monthly" as const;

    // Параллельные запросы
    const [kpis, pie, compare, trend, weather, forecast, dashboard] = await Promise.all([
      getPeriodKpis(userId, range, baseCcy),
      getCategoryPie(userId, range, baseCcy),
      getPeriodCompare(userId, range, baseCcy),
      getTrendPoints(userId, range, baseCcy, granularity),
      getWeather(userId, baseCcy, tz, range),
      getForecastMonth(userId, baseCcy),
      // Нужен safeUntilDays для KPI-виджета
      getHomeDashboard(userId, baseCcy),
    ]);

    const view = toAnalyticsView({
      range,
      kpis,
      safeUntilDays: dashboard.safeUntilDays,
      pie,
      compare,
      trend,
      weather,
      forecast,
    });

    return ok(view);
  } catch (e) {
    return serverError(e);
  }
}
