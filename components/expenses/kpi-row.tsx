import { CountUp } from "@/components/count-up";

export type ExpensesKpiData = {
  sectionTitle: string;
  sectionMeta: string;
  loans: { label: string; value: number; sub: string };
  subs: { label: string; value: number; sub: string };
  utilities: { label: string; value: number; sub: string };
  taxes: { label: string; value: number; sub: string };
  projects: { label: string; value: number; sub: string };
};

export function ExpensesKpiRow({ kpi }: { kpi: ExpensesKpiData }) {
  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>{kpi.sectionTitle}</b></div>
        <div className="meta mono">{kpi.sectionMeta}</div>
      </div>
      <div className="section-body flush">
        <div className="kpi-row" style={{ ["--kpi-cols" as string]: 5 } as React.CSSProperties}>
          <div className="kpi">
            <div className="c loan">{kpi.loans.label}</div>
            <div className="v neg money"><CountUp to={kpi.loans.value} /> ₽</div>
            <div className="s">{kpi.loans.sub}</div>
          </div>
          <div className="kpi">
            <div className="c sub">{kpi.subs.label}</div>
            <div className="v info money"><CountUp to={kpi.subs.value} /> ₽</div>
            <div className="s">{kpi.subs.sub}</div>
          </div>
          <div className="kpi">
            <div className="c util">{kpi.utilities.label}</div>
            <div className="v warn money"><CountUp to={kpi.utilities.value} /> ₽</div>
            <div className="s">{kpi.utilities.sub}</div>
          </div>
          <div className="kpi">
            <div className="c warn">{kpi.taxes.label}</div>
            <div className="v warn money"><CountUp to={kpi.taxes.value} /> ₽</div>
            <div className="s">{kpi.taxes.sub}</div>
          </div>
          <div className="kpi">
            <div className="c acc">{kpi.projects.label}</div>
            <div className="v acc">{kpi.projects.value}</div>
            <div className="s">{kpi.projects.sub}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
