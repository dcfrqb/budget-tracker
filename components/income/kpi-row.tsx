import { CountUp } from "@/components/count-up";
import { INCOME_KPI } from "@/lib/mock-income";

export function IncomeKpiRow() {
  const k = INCOME_KPI;
  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>обзор доходов</b> <span className="dim">· с начала 2026</span>
        </div>
        <div className="meta mono">4 источника · 1 ожидает</div>
      </div>
      <div className="section-body flush">
        <div className="kpi-row">
          <div className="kpi">
            <div className="c pos">ДОХОД С НАЧ. ГОДА</div>
            <div className="v pos">₽ <CountUp to={k.ytd.value} /></div>
            <div className="s">{k.ytd.sub}</div>
          </div>
          <div className="kpi">
            <div className="c acc">АКТИВНЫХ ИСТОЧНИКОВ</div>
            <div className="v acc">{k.sources.value}</div>
            <div className="s">{k.sources.sub}</div>
          </div>
          <div className="kpi">
            <div className="c warn">НАЛОГ НАЧИСЛЕНО</div>
            <div className="v warn">₽ <CountUp to={k.tax.value} /></div>
            <div className="s">{k.tax.sub}</div>
          </div>
          <div className="kpi">
            <div className="c info">ЧАСОВАЯ СТАВКА</div>
            <div className="v">
              ₽ <CountUp to={k.rate.value} />
              <span className="s" style={{ display: "inline", marginLeft: 4, fontSize: 12 }}> / h</span>
            </div>
            <div className="s">{k.rate.sub}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
