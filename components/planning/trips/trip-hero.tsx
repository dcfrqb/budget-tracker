import { formatMoney } from "@/lib/format/money";
import { Prisma } from "@prisma/client";

export type TripHeroLabels = {
  countdown_days: string;
  countdown_today: string;
  in_trip: string;
  past: string;
  hero_hours_badge: string;
  status: {
    draft: string;
    planning: string;
    active: string;
    archived: string;
  };
};

type Props = {
  name: string;
  destination: string | null;
  startDate: Date;
  endDate: Date;
  currencyCode: string;
  totalBudget: string;
  status: string;
  hoursOfWork: number | null;
  labels: TripHeroLabels;
};

export function TripHero({
  name,
  destination,
  startDate,
  endDate,
  currencyCode,
  totalBudget,
  status,
  hoursOfWork,
  labels,
}: Props) {
  const now = new Date();
  const msDay = 24 * 60 * 60 * 1000;
  const daysToStart = Math.ceil((startDate.getTime() - now.getTime()) / msDay);

  let countdownLabel: string;
  if (now >= startDate && now <= endDate) {
    countdownLabel = labels.in_trip;
  } else if (now > endDate) {
    countdownLabel = labels.past;
  } else if (daysToStart === 0) {
    countdownLabel = labels.countdown_today;
  } else {
    countdownLabel = labels.countdown_days.replace("{n}", String(daysToStart));
  }

  const statusKey = status.toLowerCase() as keyof typeof labels.status;
  const statusLabel = labels.status[statusKey] ?? status;

  const startIso = startDate.toISOString().slice(0, 10);
  const endIso = endDate.toISOString().slice(0, 10);

  return (
    <div className="section trip-hero fade-in">
      <div className="trip-hero-row">
        <div className="trip-hero-left">
          <div className="trip-hero-name mono">{name}</div>
          {destination && <div className="trip-hero-dest dim">{destination}</div>}
          <div className="trip-hero-dates dim mono">
            {startIso} — {endIso}
          </div>
        </div>
        <div className="trip-hero-right">
          <span className={`pill pill--${status.toLowerCase()}`}>{statusLabel}</span>
          <span className="trip-hero-countdown dim">{countdownLabel}</span>
          {hoursOfWork !== null && (
            <span className="trip-hero-hours dim mono">
              {labels.hero_hours_badge.replace("{n}", String(hoursOfWork))}
            </span>
          )}
        </div>
      </div>
      <div className="trip-hero-budget">
        <span className="trip-hero-budget-val mono acc">
          {formatMoney(new Prisma.Decimal(totalBudget), currencyCode, { decimals: 0 })}
        </span>
      </div>
    </div>
  );
}
