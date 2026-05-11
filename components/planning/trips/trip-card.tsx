import Link from "next/link";
import { formatMoney } from "@/lib/format/money";
import { Prisma } from "@prisma/client";

export type TripCardView = {
  id: string;
  name: string;
  destination: string | null;
  startDate: Date;
  endDate: Date;
  currencyCode: string;
  totalBudget: string;
  status: string;
  fundLinked: boolean;
  labels: {
    date_range: string;
    budget_label: string;
    fund_linked: string;
    days_to_start: string;
    in_trip: string;
    past: string;
    status_label: string;
  };
};

export function TripCard({ trip }: { trip: TripCardView }) {
  const now = new Date();
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const msDay = 24 * 60 * 60 * 1000;
  const daysToStart = Math.ceil((start.getTime() - now.getTime()) / msDay);

  let countdownLabel: string;
  if (now >= start && now <= end) {
    countdownLabel = trip.labels.in_trip;
  } else if (now > end) {
    countdownLabel = trip.labels.past;
  } else {
    countdownLabel = trip.labels.days_to_start.replace("{n}", String(daysToStart));
  }

  return (
    <Link href={`/planning/trips/${trip.id}`} className="trip-card section">
      <div className="trip-card-hd">
        <span className="trip-card-name mono">{trip.name}</span>
        <span className={`trip-card-status pill pill--${trip.status.toLowerCase()}`}>
          {trip.labels.status_label}
        </span>
      </div>
      {trip.destination && (
        <div className="trip-card-dest dim">{trip.destination}</div>
      )}
      <div className="trip-card-meta">
        <span className="mono dim">{trip.labels.date_range}</span>
        <span className="trip-card-countdown dim">{countdownLabel}</span>
      </div>
      <div className="trip-card-footer">
        <span className="dim">{trip.labels.budget_label}</span>
        <span className="mono acc">
          {formatMoney(new Prisma.Decimal(trip.totalBudget), trip.currencyCode, { decimals: 0 })}
        </span>
        {trip.fundLinked && (
          <span className="trip-card-fund-badge dim">{trip.labels.fund_linked}</span>
        )}
      </div>
    </Link>
  );
}
