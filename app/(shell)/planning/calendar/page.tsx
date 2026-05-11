import Link from "next/link";
import { getCurrentUserId } from "@/lib/api/auth";
import { getCurrentUserTz } from "@/lib/data/_users/get-user-tz";
import { getT } from "@/lib/i18n/server";
import { getPlanningTimeline } from "@/lib/data/planning-timeline";
import { getPlannedEvents } from "@/lib/data/planned-events";
import { formatMoney } from "@/lib/format/money";
import { Prisma } from "@prisma/client";
import { PlanningStatusStrip } from "@/components/planning/status-strip";
import { TimelineLegend } from "@/components/planning/timeline/timeline-legend";
import { Timeline } from "@/components/planning/timeline/timeline";
import { MiniCalendar } from "@/components/planning/mini-calendar";
import { UpcomingDates } from "@/components/planning/upcoming-dates";
import type { TimelineItemView } from "@/components/planning/timeline/timeline";
import type { TimelineLegendLabels } from "@/components/planning/timeline/timeline-legend";
import type { MiniCalendarLabels, ItemCountsByDay } from "@/components/planning/mini-calendar";
import type { UpcomingDateItem, UpcomingDatesLabels } from "@/components/planning/upcoming-dates";
import type { TimelineItemKind } from "@/lib/data/planning-timeline";

export const dynamic = "force-dynamic";

type Horizon = "30d" | "90d" | "1y" | "all";

const VALID_HORIZONS: Horizon[] = ["30d", "90d", "1y", "all"];

const HORIZON_DAYS: Record<Horizon, number> = {
  "30d":  30,
  "90d":  90,
  "1y":   365,
  "all":  1825,
};

const MONTH_KEYS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] as const;
const WEEKDAY_KEYS = ["sun","mon","tue","wed","thu","fri","sat"] as const;

export default async function PlanningCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ horizon?: string; day?: string }>;
}) {
  const sp = await searchParams;

  const horizon: Horizon = VALID_HORIZONS.includes(sp.horizon as Horizon)
    ? (sp.horizon as Horizon)
    : "90d";

  const day = typeof sp.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.day)
    ? sp.day
    : null;

  const horizonDays = HORIZON_DAYS[horizon];

  const [userId, t, tz] = await Promise.all([
    getCurrentUserId(),
    getT(),
    getCurrentUserTz(),
  ]);

  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  // Month/day labels for status strip
  const monthShort = MONTH_KEYS.map(k => t(`common.month.short.${k}` as Parameters<typeof t>[0]));
  const nowInTz = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const monthLabel = `${monthShort[nowInTz.getMonth()]} ${nowInTz.getFullYear()}`;
  const daysInMonth = new Date(nowInTz.getFullYear(), nowInTz.getMonth() + 1, 0).getDate();
  const dayLabel = `${nowInTz.getDate()}/${daysInMonth}`;

  // Fetch timeline items
  const rawItems = await getPlanningTimeline(userId, { from, to });

  // Convert to view model with formatted amounts
  const timelineItems: TimelineItemView[] = rawItems.map((item) => ({
    id: item.id,
    kind: item.kind,
    date: item.date,
    isoDate: item.date.toISOString().slice(0, 10),
    label: item.label,
    formattedAmount: item.amount && item.currencyCode
      ? formatMoney(item.amount, item.currencyCode, { decimals: 0 })
      : null,
    href: item.href,
    glyph: item.glyph,
  }));

  // Build itemsByDay for mini-calendar
  const itemsByDay: ItemCountsByDay = {};
  for (const item of timelineItems) {
    if (!itemsByDay[item.isoDate]) itemsByDay[item.isoDate] = {};
    const counts = itemsByDay[item.isoDate]!;
    counts[item.kind] = (counts[item.kind] ?? 0) + 1;
  }

  // Legend labels
  const legendLabels: TimelineLegendLabels = {
    event:        t("planning.timeline.legend.event"),
    subscription: t("planning.timeline.legend.subscription"),
    loan:         t("planning.timeline.legend.loan"),
    fund_target:  t("planning.timeline.legend.fund_target"),
    txn_planned:  t("planning.timeline.legend.txn_planned"),
  };

  // Timeline labels
  const timelineLabels = {
    title:       t("planning.timeline.title"),
    subtitle:    t("planning.timeline.subtitle"),
    empty_title: t("planning.timeline.empty_title"),
    empty_body:  t("planning.timeline.empty_body"),
    today:       t("planning.timeline.today"),
  };

  // Mini-calendar labels
  const weekdayLabels = WEEKDAY_KEYS.map(k => t(`common.weekday.short.${k}` as Parameters<typeof t>[0]));
  const miniCalLabels: MiniCalendarLabels = {
    title:    t("planning.mini_calendar.title"),
    subtitle: t("planning.mini_calendar.subtitle"),
    click_hint: t("planning.mini_calendar.click_hint"),
    weekdays: weekdayLabels,
    months: monthShort,
  };

  // Upcoming: first 7 timeline items
  const first7 = timelineItems.slice(0, 7);
  const upcomingItems: UpcomingDateItem[] = first7.map((item) => {
    const d = item.date;
    const mo = monthShort[d.getMonth()];
    return {
      id: item.id,
      day: String(d.getDate()),
      mo,
      n: item.label,
      m: t(`planning.timeline.legend.${item.kind}` as Parameters<typeof t>[0]),
      amount: item.formattedAmount ?? "—",
    };
  });

  const upcomingDatesLabels: UpcomingDatesLabels = {
    title:    t("planning.upcoming_dates.title"),
    subtitle: t("planning.upcoming_dates.subtitle"),
    meta:     t("planning.upcoming_dates.meta", { vars: { count: String(upcomingItems.length), word: "" } }),
    empty:    t("planning.upcoming_dates.empty"),
  };

  // Breadcrumb labels
  const breadcrumbPlanning = t("planning.calendar_page.breadcrumb_planning");
  const breadcrumbCalendar = t("planning.calendar_page.breadcrumb_calendar");
  const h1 = t("planning.calendar_page.h1");
  const sub = t("planning.calendar_page.sub");

  return (
    <>
      <PlanningStatusStrip monthLabel={monthLabel} dayLabel={dayLabel} />

      <div className="section fade-in" style={{ animationDelay: "0ms", marginBottom: 0 }}>
        <nav className="cal-breadcrumb" aria-label="breadcrumb">
          <Link href="/planning">{breadcrumbPlanning}</Link>
          <span className="cal-breadcrumb-sep">/</span>
          <span className="cal-breadcrumb-cur">{breadcrumbCalendar}</span>
        </nav>
        <div className="section-hd">
          <div className="ttl mono">
            <b>{h1}</b> <span className="dim">· {sub}</span>
          </div>
        </div>
      </div>

      <TimelineLegend labels={legendLabels} />
      <Timeline
        items={timelineItems}
        horizonDays={horizonDays}
        selectedDay={day}
        labels={timelineLabels}
      />
      <MiniCalendar
        itemsByDay={itemsByDay}
        selectedDay={day}
        horizon={horizon}
        labels={miniCalLabels}
      />
      <UpcomingDates items={upcomingItems} labels={upcomingDatesLabels} />
    </>
  );
}
