import { CountUp } from "@/components/count-up";

export type IncomeKpiData = {
  ytd: { value: number; sub: string };
  sources: { value: number; sub: string };
  tax: { value: number; sub: string };
  rate: { value: number; sub: string };
};

export function IncomeKpiRow({ kpi }: { kpi: IncomeKpiData }) {
  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>обзор доходов</b> <span className="dim">· с начала года</span>
        </div>
        <div className="meta mono">{kpi.sources.value} источников</div>
      </div>
      <div className="section-body flush">
        <div className="kpi-row">
          <div className="kpi">
            <div className="c pos">ДОХОД С НАЧ. ГОДА</div>
            <div className="v pos">₽ <CountUp to={kpi.ytd.value} /></div>
            <div className="s">{kpi.ytd.sub}</div>
          </div>
          <div className="kpi">
            <div className="c acc">АКТИВНЫХ ИСТОЧНИКОВ</div>
            <div className="v acc">{kpi.sources.value}</div>
            <div className="s">{kpi.sources.sub}</div>
          </div>
          <div className="kpi">
            <div className="c warn">НАЛОГ НАЧИСЛЕНО</div>
            <div className="v warn">₽ <CountUp to={kpi.tax.value} /></div>
            <div className="s">{kpi.tax.sub}</div>
          </div>
          <div className="kpi">
            <div className="c info">ЧАСОВАЯ СТАВКА</div>
            <div className="v">
              ₽ <CountUp to={kpi.rate.value} />
              <span className="s" style={{ display: "inline", marginLeft: 4, fontSize: 12 }}> / h</span>
            </div>
            <div className="s">{kpi.rate.sub}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
