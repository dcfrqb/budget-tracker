import {
  AvailableBlock,
  BalancesBlock,
  SafeUntilBlock,
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { getCurrentUserId } from "@/lib/api/auth";
import { getFundsWithProgress } from "@/lib/data/funds";
import { getPlannedEvents } from "@/lib/data/planned-events";
import { Prisma } from "@prisma/client";
import { formatMoney } from "@/lib/format/money";
import { getT } from "@/lib/i18n/server";

const MONTH_KEYS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] as const;

type FundsTotalProps = {
  progressPct: number;
  fundsCount: number;
  labels: {
    title: string;
    fundsCount: string;
    totalSavedFmt: string;
    goalKey: string;
    progressKey: string;
    contribKey: string;
    totalGoalFmt: string;
    monthlyContribFmt: string;
  };
};

function FundsTotal({ progressPct, fundsCount, labels }: FundsTotalProps) {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>{labels.title}</span>
        <span className="tiny mono">{labels.fundsCount}</span>
      </div>
      <div className="mono money" style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)" }}>
        {labels.totalSavedFmt}
      </div>
      <div className="sum-table" style={{ marginTop: 6 }}>
        <div className="r"><span>{labels.goalKey}</span><span className="v money">{labels.totalGoalFmt}</span></div>
        <div className="r"><span>{labels.progressKey}</span><span className="v" style={{ color: "var(--accent)" }}>{progressPct}%</span></div>
        <div className="r"><span>{labels.contribKey}</span><span className="v money">{labels.monthlyContribFmt}</span></div>
      </div>
    </div>
  );
}

type NextEventRow = { d: string; n: string; v: string };

type NextEventsProps = {
  rows: NextEventRow[];
  labels: { title: string; meta: string; empty: string };
};

function NextEvents({ rows, labels }: NextEventsProps) {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>{labels.title}</span>
        <span className="tiny mono">{labels.meta}</span>
      </div>
      <div className="next-list">
        {rows.map((r, i) => (
          <div key={i} className="r">
            <span className="d mono">{r.d}</span>
            <span className="n">{r.n}</span>
            <span className="v mono">{r.v}</span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
            {labels.empty}
          </div>
        )}
      </div>
    </div>
  );
}

export default async function PlanningSummary() {
  const now = new Date();
  const window14End = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);
  const monthShort = MONTH_KEYS.map(k => t(`common.month.short.${k}` as Parameters<typeof t>[0]));

  const [funds, events14] = await Promise.all([
    getFundsWithProgress(userId),
    getPlannedEvents(userId, { from: now, to: window14End }),
  ]);

  const totalSaved = funds.reduce((s, f) => s.plus(f.currentAmount), new Prisma.Decimal(0));
  const totalGoal = funds.reduce((s, f) => s.plus(f.goalAmount), new Prisma.Decimal(0));
  const progressPct = totalGoal.isZero()
    ? 0
    : Math.round(totalSaved.div(totalGoal).times(100).toNumber());
  const totalMonthly = funds.reduce(
    (s, f) => f.monthlyContribution ? s.plus(f.monthlyContribution) : s,
    new Prisma.Decimal(0),
  );

  const nextEventRows: NextEventRow[] = events14.map((evt) => {
    const diffDays = Math.ceil((evt.eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return {
      d: `${evt.eventDate.getUTCDate()} ${monthShort[evt.eventDate.getUTCMonth()]}`,
      n: evt.name,
      v: evt.expectedAmount
        ? formatMoney(new Prisma.Decimal(evt.expectedAmount), evt.currencyCode ?? "RUB")
        : `${diffDays}${t("common.unit.day")}`,
    };
  });

  const nearestEvent = events14[0];
  const nearestLabel = nearestEvent
    ? `${nearestEvent.eventDate.getUTCDate()} ${monthShort[nearestEvent.eventDate.getUTCMonth()]} · ${Math.ceil((nearestEvent.eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))}${t("common.unit.day")}`
    : t("summary.planning.nearest_none");

  return (
    <SummaryShell>
      <SafeUntilBlock />
      <FundsTotal
        progressPct={progressPct}
        fundsCount={funds.length}
        labels={{
          title: t("summary.planning.funds_label"),
          fundsCount: `${funds.length} ${t("planning.kpi.saved_sub", { vars: { count: String(funds.length) } }).split(" ").slice(1).join(" ")}`,
          totalSavedFmt: formatMoney(totalSaved, "RUB", { decimals: 0 }),
          goalKey: t("summary.planning.goal_total_key"),
          progressKey: t("summary.planning.progress_key"),
          contribKey: t("summary.planning.contrib_month_key"),
          totalGoalFmt: formatMoney(totalGoal, "RUB", { decimals: 0 }),
          monthlyContribFmt: formatMoney(totalMonthly, "RUB", { decimals: 0 }),
        }}
      />
      <NextEvents
        rows={nextEventRows}
        labels={{
          title: t("summary.planning.events_label"),
          meta: t("summary.planning.events_meta"),
          empty: t("summary.planning.events_none"),
        }}
      />
      <AvailableBlock />
      <BalancesBlock />
      <SessionStateBlock
        rows={[
          { tone: "pos", k: t("summary.planning.mode_key"), v: t("summary.planning.mode_val"), vClass: "pos" },
          { tone: "pos", k: t("summary.planning.view_key"), v: t("summary.planning.view_val"), vClass: "acc" },
          { tone: nearestEvent ? "warn" : "pos", k: t("summary.planning.nearest_key"), v: nearestLabel, vClass: nearestEvent ? "warn" : "muted" },
        ]}
      />
    </SummaryShell>
  );
}
