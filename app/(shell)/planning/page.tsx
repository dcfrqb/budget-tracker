import { BigPurchases } from "@/components/planning/big-purchases";
import { FundsSection } from "@/components/planning/funds";
import { HoursCalculator } from "@/components/planning/hours-calc";
import { PlanningCalendar } from "@/components/planning/calendar";
import { PlanningKpiRow } from "@/components/planning/kpi-row";
import { PlanningStatusStrip } from "@/components/planning/status-strip";
import { UpcomingDates } from "@/components/planning/upcoming-dates";
import { HOURS_PER_MONTH_DEFAULT } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { getFundsWithProgress } from "@/lib/data/funds";
import { getPlannedEvents } from "@/lib/data/planned-events";
import { getPrimaryWorkSource } from "@/lib/data/work-sources";
import { getT } from "@/lib/i18n/server";
import { Prisma } from "@prisma/client";
import { formatRubPrefix } from "@/lib/format/money";
import { db } from "@/lib/db";
import type { FundCardView } from "@/components/planning/funds";
import type { BigPurchaseView } from "@/components/planning/big-purchases";
import type { CalendarMonth, CalendarEvent } from "@/components/planning/calendar";
import type { UpcomingDateItem } from "@/components/planning/upcoming-dates";
import type { PlanningKpiData } from "@/components/planning/kpi-row";

export const dynamic = "force-dynamic";

const MONTH_KEYS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] as const;
const WEEKDAY_KEYS = ["sun","mon","tue","wed","thu","fri","sat"] as const;

type FundKind = "TRIP" | "BUY" | "VAULT" | "GIFT" | "OTHER";
type EventKind = "BIRTHDAY" | "HOLIDAY" | "TRIP" | "PURCHASE" | "OTHER";

export default async function PlanningPage() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);

  const monthShort = MONTH_KEYS.map(k => t(`common.month.short.${k}` as Parameters<typeof t>[0]));
  const weekdayShort = WEEKDAY_KEYS.map(k => t(`common.weekday.short.${k}` as Parameters<typeof t>[0]));

  function fundKindLabel(kind: string): string {
    const key = `planning.fund_kind.${kind}` as Parameters<typeof t>[0];
    return t(key);
  }

  function eventKindLetter(kind: string): string {
    const key = `planning.event_kind_letter.${kind}` as Parameters<typeof t>[0];
    return t(key);
  }

  const now = new Date();
  const window90End = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const window14End = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const [funds, events90, primaryWorkSource, accounts] = await Promise.all([
    getFundsWithProgress(userId),
    getPlannedEvents(userId, { from: now, to: window90End }),
    getPrimaryWorkSource(userId),
    db.account.findMany({
      where: { userId, isArchived: false, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, currencyCode: true },
    }),
  ]);

  // ── Hourly rate ─────────────────────────────────────────────
  let hourlyRate: Prisma.Decimal | null = null;
  let hourlyRateLabel = "";
  if (primaryWorkSource) {
    const hoursPerMonth = primaryWorkSource.hoursPerMonth ?? HOURS_PER_MONTH_DEFAULT;
    if (primaryWorkSource.hourlyRate) {
      hourlyRate = new Prisma.Decimal(primaryWorkSource.hourlyRate);
    } else if (primaryWorkSource.baseAmount) {
      hourlyRate = new Prisma.Decimal(primaryWorkSource.baseAmount).div(hoursPerMonth);
    }
    if (hourlyRate) {
      hourlyRateLabel = `₽ ${hourlyRate.toFixed(0)}/${t("common.unit.hour")}`;
    }
  }

  // ── KPI ─────────────────────────────────────────────────────
  const totalSaved = funds.reduce(
    (s, f) => s.plus(f.currentAmount),
    new Prisma.Decimal(0),
  );
  const totalMonthly = funds.reduce(
    (s, f) => f.monthlyContribution ? s.plus(f.monthlyContribution) : s,
    new Prisma.Decimal(0),
  );

  // Next nearest event
  const nextEvent = events90[0];
  const nextEventLabel = nextEvent
    ? `${nextEvent.eventDate.getUTCDate()} ${monthShort[nextEvent.eventDate.getUTCMonth()]}`
    : t("planning.kpi.next_event_none");
  const nextEventDiff = nextEvent
    ? Math.ceil((nextEvent.eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    : 0;

  // Total hours to reach all goals
  const totalRemaining = funds.reduce(
    (s, f) => s.plus(f.remainingAmount.gt(0) ? f.remainingAmount : 0),
    new Prisma.Decimal(0),
  );
  const totalHoursToGoal = hourlyRate && !hourlyRate.isZero()
    ? Math.round(totalRemaining.div(hourlyRate).toNumber())
    : 0;

  const kpi: PlanningKpiData = {
    saved: {
      label: t("planning.kpi.saved"),
      value: Number(totalSaved.toFixed(0)),
      sub: t("planning.kpi.saved_sub", { vars: { count: String(funds.length) } }),
    },
    monthly: {
      label: t("planning.kpi.monthly"),
      value: Number(totalMonthly.toFixed(0)),
      sub: t("planning.kpi.monthly_sub"),
    },
    next: {
      label: t("planning.kpi.next_event"),
      label2: nextEventLabel,
      sub: nextEvent
        ? t("planning.calendar.in_days", { vars: { n: String(nextEventDiff) } }).trim() || `+${nextEventDiff}${t("common.unit.day")}`
        : t("planning.kpi.next_event_none"),
    },
    hours: {
      label: t("planning.kpi.hours"),
      value: totalHoursToGoal,
      sub: hourlyRateLabel
        ? t("planning.hours_rate_label", { vars: { rate: hourlyRateLabel } })
        : t("planning.kpi.hours_no_rate"),
    },
  };

  // ── Fund cards ───────────────────────────────────────────────
  const fundViews: FundCardView[] = funds.map((f) => {
    const current = new Prisma.Decimal(f.currentAmount);
    const goal = new Prisma.Decimal(f.goalAmount);
    const pct = Math.min(100, Math.round(f.progressPct));
    const dueLabel = f.targetDate
      ? `${monthShort[f.targetDate.getUTCMonth()]} ${f.targetDate.getUTCFullYear()}`
      : t("planning.deadline_none");
    const remaining = f.remainingAmount.gt(0) ? f.remainingAmount : new Prisma.Decimal(0);
    const monthlyContrib = f.monthlyContribution
      ? new Prisma.Decimal(f.monthlyContribution)
      : new Prisma.Decimal(0);
    const monthsLeft = !monthlyContrib.isZero()
      ? Math.ceil(remaining.div(monthlyContrib).toNumber())
      : null;

    const hoursToGoal = hourlyRate && !hourlyRate.isZero()
      ? Math.round(remaining.div(hourlyRate).toNumber())
      : 0;

    return {
      id: f.id,
      kind: f.kind.toLowerCase(),
      kindLabel: fundKindLabel(f.kind),
      dueLabel,
      name: f.name,
      sub: f.note ?? "",
      stats: [
        { k: t("planning.fund_stat.saved"), v: formatRubPrefix(current), tone: "acc" },
        { k: t("planning.fund_stat.goal"), v: formatRubPrefix(goal) },
        ...(monthlyContrib.gt(0)
          ? [{ k: t("planning.fund_stat.monthly_contrib"), v: formatRubPrefix(monthlyContrib) }]
          : []),
        ...(monthsLeft !== null
          ? [{ k: t("planning.fund_stat.months_left"), v: String(monthsLeft) }]
          : []),
      ],
      progLeft: formatRubPrefix(current),
      progRight: formatRubPrefix(goal),
      pct,
      hours: hoursToGoal,
      hoursUnit: t("common.unit.hour"),
      currencyCode: f.currencyCode,
      currentAmount: String(f.currentAmount),
    };
  });

  // ── Big purchases (PURCHASE / BUY-kind funds) ────────────────
  const bigPurchaseViews: BigPurchaseView[] = funds
    .filter((f) => f.kind === "BUY" || f.kind === "OTHER")
    .map((f) => {
      const pct = Math.min(100, Math.round(f.progressPct));
      const remaining = f.remainingAmount.gt(0) ? f.remainingAmount : new Prisma.Decimal(0);
      const hoursToGoal = hourlyRate && !hourlyRate.isZero()
        ? Math.round(remaining.div(hourlyRate).toNumber())
        : 0;
      const dueLabel = f.targetDate
        ? `${monthShort[f.targetDate.getUTCMonth()]} ${f.targetDate.getUTCFullYear()}`
        : t("planning.deadline_none");
      const iconKey = `planning.purchase_icon.${f.kind}` as Parameters<typeof t>[0];
      return {
        id: f.id,
        icon: t(iconKey),
        name: f.name,
        sub: f.note ?? "",
        dueLabel,
        pct,
        hoursMain: hoursToGoal > 0 ? `${hoursToGoal} ${t("common.unit.hour")}` : "—",
        hoursSub: hourlyRateLabel
          ? t("planning.hours_rate_label", { vars: { rate: hourlyRateLabel } })
          : t("planning.kpi.hours_no_rate"),
        pctTone: pct >= 90 ? "warn" : pct === 0 ? "dim" : undefined,
      };
    });

  // ── Calendar months ──────────────────────────────────────────
  const monthMap = new Map<string, CalendarMonth>();
  for (const evt of events90) {
    const mo = evt.eventDate.getUTCMonth();
    const yr = evt.eventDate.getUTCFullYear();
    const key = `${yr}-${mo}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        id: key,
        short: monthShort[mo],
        year: String(yr),
        sub: "",
        events: [],
      });
    }
    const diffDays = Math.ceil((evt.eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const calEvt: CalendarEvent = {
      id: evt.id,
      date: String(evt.eventDate.getUTCDate()),
      weekday: weekdayShort[evt.eventDate.getUTCDay()],
      inDays: diffDays <= 30
        ? t("planning.calendar.in_days", { vars: { n: String(diffDays) } })
        : "",
      letter: eventKindLetter(evt.kind),
      kind: evt.kind.toLowerCase(),
      name: evt.name,
      sub: evt.note ?? "",
      fundLabel: undefined,
      amount: evt.expectedAmount ? formatRubPrefix(new Prisma.Decimal(evt.expectedAmount)) : "—",
      amountTone: diffDays <= 14 ? "warn" : undefined,
    };
    monthMap.get(key)!.events.push(calEvt);
  }
  const calendarMonths = [...monthMap.values()].map((m) => ({
    ...m,
    sub: t("planning.calendar.events_count", { vars: { n: String(m.events.length) } }),
  }));

  // ── Upcoming dates (14d) ─────────────────────────────────────
  const upcomingEvents = await getPlannedEvents(userId, { from: now, to: window14End });
  const upcomingItems: UpcomingDateItem[] = upcomingEvents.map((evt) => ({
    id: evt.id,
    day: String(evt.eventDate.getUTCDate()),
    mo: monthShort[evt.eventDate.getUTCMonth()],
    n: evt.name,
    m: evt.note ?? fundKindLabel(evt.kind),
    amount: evt.expectedAmount ? formatRubPrefix(new Prisma.Decimal(evt.expectedAmount)) : "—",
  }));

  return (
    <>
      <PlanningStatusStrip />
      <PlanningKpiRow kpi={kpi} fundsCount={funds.length} />
      <HoursCalculator />
      <PlanningCalendar months={calendarMonths} />
      <FundsSection funds={fundViews} accounts={accounts} />
      <BigPurchases purchases={bigPurchaseViews} hourlyRate={hourlyRateLabel || undefined} />
      <UpcomingDates items={upcomingItems} />
    </>
  );
}
