export type AnalyticsPeriod = "1m" | "3m" | "6m" | "12m" | "ytd";

export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriod = "3m";

export function parseAnalyticsPeriod(raw: string | undefined): AnalyticsPeriod {
  if (raw === "1m" || raw === "3m" || raw === "6m" || raw === "12m" || raw === "ytd") {
    return raw;
  }
  return DEFAULT_ANALYTICS_PERIOD;
}
