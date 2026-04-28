import { CountUp } from "@/components/count-up";

export type PlanningKpiData = {
  sectionTitle: string;
  sectionSubtitle: string;
  fundsCountLabel: string;
  hoursUnit: string;
  saved: { label: string; value: number; sub: string };
  monthly: { label: string; value: number; sub: string };
  next: { label: string; label2: string; sub: string };
  hours: { label: string; value: number; sub: string };
};

export function PlanningKpiRow({ kpi }: { kpi: PlanningKpiData }) {
  const k = kpi;
  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>{k.sectionTitle}</b> <span className="dim">· {k.sectionSubtitle}</span></div>
        <div className="meta mono">{k.fundsCountLabel}</div>
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
            <div className="v"><CountUp to={k.hours.value} format="int" /> {k.hoursUnit}</div>
            <div className="s">{k.hours.sub}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
