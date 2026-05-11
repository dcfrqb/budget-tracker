import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUserId } from "@/lib/api/auth";
import { getT } from "@/lib/i18n/server";
import { getTripWithBookings } from "@/lib/data/trips";
import { getPrimaryWorkSource } from "@/lib/data/work-sources";
import { getLatestRatesMap, convertToBase } from "@/lib/data/wallet";
import { listAllCurrencies } from "@/lib/data/currencies";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { HOURS_PER_MONTH_DEFAULT } from "@/lib/constants";
import { formatMoney } from "@/lib/format/money";
import type { TripBookingKind } from "@prisma/client";
import { TripHero } from "@/components/planning/trips/trip-hero";
import { TripBudgetSavings } from "@/components/planning/trips/trip-budget-savings";
import { TripCategoryRollup } from "@/components/planning/trips/trip-category-rollup";
import type { RollupRow, RollupKind } from "@/components/planning/trips/trip-category-rollup";
import { TripBookings } from "@/components/planning/trips/trip-bookings";

export const dynamic = "force-dynamic";

const BOOKING_KINDS: TripBookingKind[] = [
  "TRANSPORT",
  "LODGING",
  "FOOD",
  "ACTIVITY",
  "OTHER",
];

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);

  const [trip, primaryWorkSource, rates, currencies, accounts] = await Promise.all([
    getTripWithBookings(userId, id),
    getPrimaryWorkSource(userId),
    getLatestRatesMap(),
    listAllCurrencies(),
    db.account.findMany({
      where: { userId, isArchived: false, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, currencyCode: true },
    }),
  ]);

  if (!trip) notFound();

  const tripCcy = trip.currencyCode;

  // ── Hours of work ─────────────────────────────────────────────
  let hoursOfWork: number | null = null;
  if (primaryWorkSource && primaryWorkSource.rateAmount) {
    const hoursPerMonth = primaryWorkSource.hoursPerMonth ?? HOURS_PER_MONTH_DEFAULT;
    let hourlyRate: Prisma.Decimal;
    if (primaryWorkSource.rateType === "HOURLY") {
      hourlyRate = new Prisma.Decimal(primaryWorkSource.rateAmount);
    } else {
      hourlyRate = new Prisma.Decimal(primaryWorkSource.rateAmount).div(hoursPerMonth);
    }
    if (!hourlyRate.isZero()) {
      const budget = new Prisma.Decimal(trip.totalBudget);
      const budgetInWorkCcy = convertToBase(budget, tripCcy, primaryWorkSource.currencyCode ?? "RUB", rates);
      if (budgetInWorkCcy) {
        hoursOfWork = Math.round(budgetInWorkCcy.div(hourlyRate).toNumber());
      }
    }
  }

  // ── Category rollup ────────────────────────────────────────────
  const rawAllocations =
    trip.budgetAllocations && typeof trip.budgetAllocations === "object"
      ? (trip.budgetAllocations as Record<string, string>)
      : {};

  const rollupRows: RollupRow[] = BOOKING_KINDS.map((kind) => {
    const allocation = rawAllocations[kind] ?? "0";
    const paidBookings = trip.bookings.filter(
      (b) => b.kind === kind && b.status === "PAID",
    );
    let spentInTripCcy = new Prisma.Decimal(0);
    for (const booking of paidBookings) {
      const converted = convertToBase(booking.amount, booking.currencyCode, tripCcy, rates);
      if (converted) spentInTripCcy = spentInTripCcy.plus(converted);
    }
    const alloc = new Prisma.Decimal(allocation);
    const remaining = alloc.minus(spentInTripCcy);
    return {
      kind: kind as RollupKind,
      allocation,
      spent: spentInTripCcy.toFixed(2),
      remaining: remaining.toFixed(2),
      currencyCode: tripCcy,
    };
  });

  // ── Labels ────────────────────────────────────────────────────
  const heroLabels = {
    countdown_days:   t("planning.trips.detail.countdown_days"),
    countdown_today:  t("planning.trips.detail.countdown_today"),
    in_trip:          t("planning.trips.detail.in_trip"),
    past:             t("planning.trips.detail.past"),
    hero_hours_badge: t("planning.trips.detail.hero_hours_badge"),
    status: {
      draft:    t("planning.trips.card.status.draft"),
      planning: t("planning.trips.card.status.planning"),
      active:   t("planning.trips.card.status.active"),
      archived: t("planning.trips.card.status.archived"),
    },
  };

  const savingsLabels = {
    title:            t("planning.trips.savings.title"),
    current:          t("planning.trips.savings.current"),
    goal:             t("planning.trips.savings.goal"),
    required_monthly: t("planning.trips.savings.required_monthly"),
    deadline_label:   t("planning.trips.savings.deadline_label"),
    no_fund_hint:     t("planning.trips.savings.no_fund_hint"),
    link_fund_cta:    t("planning.trips.savings.link_fund_cta"),
    topup_fund_cta:   t("planning.trips.savings.topup_fund_cta"),
  };

  const rollupLabels = {
    title: t("planning.trips.rollup.title"),
    kind: {
      transport: t("planning.trips.rollup.kind.transport"),
      lodging:   t("planning.trips.rollup.kind.lodging"),
      food:      t("planning.trips.rollup.kind.food"),
      activity:  t("planning.trips.rollup.kind.activity"),
      other:     t("planning.trips.rollup.kind.other"),
    },
    col_allocation:    t("planning.trips.rollup.col_allocation"),
    col_spent:         t("planning.trips.rollup.col_spent"),
    col_remaining:     t("planning.trips.rollup.col_remaining"),
    edit_allocation:   t("planning.trips.rollup.edit_allocation"),
    save_allocation:   t("planning.trips.rollup.save_allocation"),
    mixed_ccy_tooltip: t("planning.trips.rollup.mixed_ccy_tooltip"),
  };

  const bookingsLabels = {
    title:                   t("planning.trips.bookings.title"),
    add_row:                 t("planning.trips.bookings.add_row"),
    col_kind:                t("planning.trips.bookings.col_kind"),
    col_label:               t("planning.trips.bookings.col_label"),
    col_date:                t("planning.trips.bookings.col_date"),
    col_amount:              t("planning.trips.bookings.col_amount"),
    col_status:              t("planning.trips.bookings.col_status"),
    col_actions:             t("planning.trips.bookings.col_actions"),
    status: {
      planned: t("planning.trips.bookings.status.planned"),
      paid:    t("planning.trips.bookings.status.paid"),
    },
    mark_paid:               t("planning.trips.bookings.mark_paid"),
    mark_paid_modal_title:   t("planning.trips.bookings.mark_paid_modal_title"),
    mark_paid_account_label: t("planning.trips.bookings.mark_paid_account_label"),
    mark_paid_submit:        t("planning.trips.bookings.mark_paid_submit"),
    edit:                    t("planning.trips.bookings.edit"),
    delete:                  t("planning.trips.bookings.delete"),
    delete_confirm:          t("planning.trips.bookings.delete_confirm"),
    empty:                   t("planning.trips.bookings.empty"),
    kind: {
      transport: t("planning.trips.rollup.kind.transport"),
      lodging:   t("planning.trips.rollup.kind.lodging"),
      food:      t("planning.trips.rollup.kind.food"),
      activity:  t("planning.trips.rollup.kind.activity"),
      other:     t("planning.trips.rollup.kind.other"),
    },
    cancel: t("common.close"),
    submit: t("planning.trips.bookings.mark_paid_submit"),
  };

  const currencyCodes = currencies.map((c) => c.code);

  const fundView = trip.fund
    ? {
        id: trip.fund.id,
        name: trip.fund.name,
        currencyCode: trip.fund.currencyCode,
        currentAmount: String(trip.fund.currentAmount),
        goalAmount: String(trip.fund.goalAmount),
        monthlyContribution: trip.fund.monthlyContribution
          ? String(trip.fund.monthlyContribution)
          : null,
      }
    : null;

  const bookingViews = trip.bookings.map((b) => ({
    id: b.id,
    kind: b.kind,
    label: b.label,
    date: b.date,
    amount: String(b.amount),
    currencyCode: b.currencyCode,
    status: b.status,
    note: b.note,
  }));

  return (
    <>
      <div className="section fade-in" style={{ marginBottom: 0 }}>
        <nav className="cal-breadcrumb" aria-label="breadcrumb">
          <Link href="/planning">
            {t("planning.calendar_page.breadcrumb_planning")}
          </Link>
          <span className="cal-breadcrumb-sep">/</span>
          <Link href="/planning/trips">
            {t("planning.trips.detail.breadcrumb")}
          </Link>
          <span className="cal-breadcrumb-sep">/</span>
          <span className="cal-breadcrumb-cur">{trip.name}</span>
        </nav>
      </div>

      <TripHero
        name={trip.name}
        destination={trip.destination}
        startDate={trip.startDate}
        endDate={trip.endDate}
        currencyCode={trip.currencyCode}
        totalBudget={String(trip.totalBudget)}
        status={trip.status}
        hoursOfWork={hoursOfWork}
        labels={heroLabels}
      />

      <TripBudgetSavings
        tripId={trip.id}
        currencyCode={trip.currencyCode}
        totalBudget={String(trip.totalBudget)}
        fund={fundView}
        labels={savingsLabels}
      />

      <TripCategoryRollup
        tripId={trip.id}
        rows={rollupRows}
        labels={rollupLabels}
      />

      <TripBookings
        tripId={trip.id}
        bookings={bookingViews}
        accounts={accounts}
        currencies={currencyCodes}
        labels={bookingsLabels}
      />
    </>
  );
}
