import Link from "next/link";
import { getCurrentUserId } from "@/lib/api/auth";
import { getT } from "@/lib/i18n/server";
import { getTrips } from "@/lib/data/trips";
import { TripCard } from "@/components/planning/trips/trip-card";
import type { TripCardView } from "@/components/planning/trips/trip-card";

export const dynamic = "force-dynamic";

export default async function TripsListPage() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);
  const trips = await getTrips(userId);

  const statusLabels = {
    draft:     t("planning.trips.card.status.draft"),
    planning:  t("planning.trips.card.status.planning"),
    active:    t("planning.trips.card.status.active"),
    archived:  t("planning.trips.card.status.archived"),
  };

  const cardViews: TripCardView[] = trips.map((trip) => {
    const start = trip.startDate.toISOString().slice(0, 10);
    const end = trip.endDate.toISOString().slice(0, 10);
    const dateRange = t("planning.trips.card.date_range")
      .replace("{start}", start)
      .replace("{end}", end);
    return {
      id: trip.id,
      name: trip.name,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      currencyCode: trip.currencyCode,
      totalBudget: String(trip.totalBudget),
      status: trip.status,
      fundLinked: !!trip.fundId,
      labels: {
        date_range: dateRange,
        budget_label: t("planning.trips.card.budget_label"),
        fund_linked: t("planning.trips.card.fund_linked"),
        days_to_start: t("planning.trips.card.days_to_start"),
        in_trip: t("planning.trips.card.in_trip"),
        past: t("planning.trips.card.past"),
        status_label: statusLabels[trip.status.toLowerCase() as keyof typeof statusLabels] ?? trip.status,
      },
    };
  });

  const isEmpty = trips.length === 0;

  return (
    <>
      <div className="section fade-in">
        <div className="section-hd">
          <div className="ttl mono">
            <b>{t("planning.trips.list.title")}</b>
            <span className="dim"> · {t("planning.trips.list.subtitle")}</span>
          </div>
          <Link href="/planning/trips/new" className="btn-link acc">
            {t("planning.trips.list.create_cta")}
          </Link>
        </div>

        {isEmpty ? (
          <div className="section-empty">
            <div className="section-empty-title dim mono">
              {t("planning.trips.list.empty_title")}
            </div>
            <div className="section-empty-body dim">
              {t("planning.trips.list.empty_body")}
            </div>
            <Link href="/planning/trips/new" className="btn-primary acc">
              {t("planning.trips.list.create_cta")}
            </Link>
          </div>
        ) : (
          <div className="trip-cards-grid">
            {cardViews.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
