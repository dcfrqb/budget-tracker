export type PeriodCode = "1m" | "3m" | "6m" | "12m" | "all";

export function startOfMonthUtcInTz(tz: string, now: Date = new Date()): Date {
  const ymFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  });
  const ymParts = ymFmt.formatToParts(now);
  const year = Number(ymParts.find((p) => p.type === "year")!.value);
  const month = Number(ymParts.find((p) => p.type === "month")!.value);
  const naive = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const wallFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const wallParts = wallFmt.formatToParts(naive);
  const get = (t: string) =>
    Number(wallParts.find((p) => p.type === t)!.value);
  const asTzMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  const offsetMs = asTzMs - naive.getTime();
  return new Date(naive.getTime() - offsetMs);
}

export function addMonths(d: Date, n: number): Date {
  const result = new Date(d);
  result.setUTCMonth(result.getUTCMonth() + n);
  return result;
}

export function periodBounds(
  period: PeriodCode,
  tz: string,
  now = new Date(),
): { from: Date; to: Date } {
  if (period === "all") {
    return { from: new Date(0), to: now };
  }
  const monthsMap: Record<Exclude<PeriodCode, "all">, number> = {
    "1m": 1,
    "3m": 3,
    "6m": 6,
    "12m": 12,
  };
  const months = monthsMap[period as Exclude<PeriodCode, "all">];
  // Start from N months ago at TZ-local month boundary
  const pivot = new Date(now);
  pivot.setUTCMonth(pivot.getUTCMonth() - (months - 1));
  const from = startOfMonthUtcInTz(tz, pivot);
  return { from, to: now };
}
