import { formatMoney } from "@/lib/format/money";
import { Prisma } from "@prisma/client";
import Link from "next/link";

export type TripBudgetSavingsLabels = {
  title: string;
  current: string;
  goal: string;
  required_monthly: string;
  deadline_label: string;
  no_fund_hint: string;
  link_fund_cta: string;
  topup_fund_cta: string;
};

type Props = {
  tripId: string;
  currencyCode: string;
  totalBudget: string;
  fund: {
    id: string;
    name: string;
    currencyCode: string;
    currentAmount: string;
    goalAmount: string;
    monthlyContribution: string | null;
  } | null;
  labels: TripBudgetSavingsLabels;
};

export function TripBudgetSavings({ tripId, currencyCode, totalBudget, fund, labels }: Props) {
  if (!fund) {
    return (
      <div className="section trip-savings fade-in">
        <div className="section-hd">
          <span className="ttl mono dim">{labels.title}</span>
        </div>
        <div className="trip-savings-empty">
          <span className="dim">{labels.no_fund_hint}</span>
          <Link href={`/planning/trips/${tripId}?linkFund=1`} className="btn-link dim">
            {labels.link_fund_cta}
          </Link>
        </div>
      </div>
    );
  }

  const current = new Prisma.Decimal(fund.currentAmount);
  const goal = new Prisma.Decimal(fund.goalAmount);
  const pct = goal.isZero() ? 0 : Math.min(100, current.div(goal).times(100).toNumber());

  return (
    <div className="section trip-savings fade-in">
      <div className="section-hd">
        <span className="ttl mono dim">{labels.title}</span>
      </div>
      <div className="trip-savings-row">
        <div className="trip-savings-stat">
          <span className="dim">{labels.current}</span>
          <span className="mono acc">
            {formatMoney(current, fund.currencyCode, { decimals: 0 })}
          </span>
        </div>
        <div className="trip-savings-stat">
          <span className="dim">{labels.goal}</span>
          <span className="mono">
            {formatMoney(goal, fund.currencyCode, { decimals: 0 })}
          </span>
        </div>
        {fund.monthlyContribution && (
          <div className="trip-savings-stat">
            <span className="dim">{labels.required_monthly}</span>
            <span className="mono">
              {formatMoney(
                new Prisma.Decimal(fund.monthlyContribution),
                fund.currencyCode,
                { decimals: 0 },
              )}
            </span>
          </div>
        )}
      </div>
      <div className="prog-bar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="prog-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="trip-savings-labels dim mono">
        <span>{formatMoney(current, fund.currencyCode, { decimals: 0 })}</span>
        <span>{formatMoney(goal, fund.currencyCode, { decimals: 0 })}</span>
      </div>
    </div>
  );
}
