import { CountUp } from "@/components/count-up";

export type PlanningKpiData = {
  saved: { label: string; value: number; sub: string };
  monthly: { label: string; value: number; sub: string };
  next: { label: string; label2: string; sub: string };
  hours: { label: string; value: number; sub: string };
};

export function PlanningKpiRow({
  kpi,
  fundsCount = 0,
}: {
  kpi: PlanningKpiData;
  fundsCount?: number;
}) {
  const k = kpi;
  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>план будущего</b> <span className="dim">· обзор</span></div>
        <div className="meta mono">{fundsCount} накоплений</div>
      </div>
      <div className="section-body flush">
        <div className="kpi-row">
          <div className="kpi">
            <div className="c acc">{k.saved.label}</div>
            <div className="v acc">₽ <CountUp to={k.saved.value} /></div>
            <div className="s">{k.saved.sub}</div>
          </div>
          <div className="kpi">
            <div className="c pos">{k.monthly.label}</div>
            <div className="v pos">₽ <CountUp to={k.monthly.value} /></div>
            <div className="s">{k.monthly.sub}</div>
          </div>
          <div className="kpi">
            <div className="c warn">{k.next.label}</div>
            <div className="v warn">{k.next.label2}</div>
            <div className="s">{k.next.sub}</div>
          </div>
          <div className="kpi">
            <div className="c">{k.hours.label}</div>
            <div className="v"><CountUp to={k.hours.value} format="int" /> ч</div>
            <div className="s">{k.hours.sub}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
