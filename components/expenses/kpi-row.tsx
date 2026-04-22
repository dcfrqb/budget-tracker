import { CountUp } from "@/components/count-up";
import { EXPENSES_KPI } from "@/lib/mock-expenses";

export function ExpensesKpiRow() {
  const k = EXPENSES_KPI;
  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>обзор обязательств</b></div>
        <div className="meta mono">резерв в этом мес. ₽ 74 600</div>
      </div>
      <div className="section-body flush">
        <div className="kpi-row" style={{ ["--kpi-cols" as string]: 5 } as React.CSSProperties}>
          <div className="kpi">
            <div className="c loan">{k.loans.label}</div>
            <div className="v neg">₽ <CountUp to={k.loans.value} /></div>
            <div className="s">{k.loans.sub}</div>
          </div>
          <div className="kpi">
            <div className="c sub">{k.subs.label}</div>
            <div className="v info">₽ <CountUp to={k.subs.value} /></div>
            <div className="s">{k.subs.sub}</div>
          </div>
          <div className="kpi">
            <div className="c util">{k.utilities.label}</div>
            <div className="v warn">₽ <CountUp to={k.utilities.value} /></div>
            <div className="s">{k.utilities.sub}</div>
          </div>
          <div className="kpi">
            <div className="c tax">{k.taxes.label}</div>
            <div className="v acc">₽ <CountUp to={k.taxes.value} /></div>
            <div className="s">{k.taxes.sub}</div>
          </div>
          <div className="kpi">
            <div className="c acc">{k.projects.label}</div>
            <div className="v acc">{k.projects.value}</div>
            <div className="s">{k.projects.sub}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
