import { CountUp } from "@/components/count-up";
import { PLANNING_KPI } from "@/lib/mock-planning";

export function PlanningKpiRow() {
  const k = PLANNING_KPI;
  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>план будущего</b> <span className="dim">· обзор</span></div>
        <div className="meta mono">6 накоплений · 4 покупки · 1 трип</div>
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
            <div className="c info">{k.hours.label}</div>
            <div className="v info"><CountUp to={k.hours.value} format="int" /> ч</div>
            <div className="s">{k.hours.sub}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
