import { CountUp } from "@/components/count-up";
import { ANALYTICS_KPI } from "@/lib/mock-analytics";

function Val({ v, fmt }: { v: number; fmt: string }) {
  if (fmt === "days") return <><CountUp to={v} format="int" /> дн</>;
  if (fmt === "money-pos") return <>+₽ <CountUp to={v} /></>;
  return <>₽ <CountUp to={v} /></>;
}

export function AnalyticsKpiRow() {
  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>ключевые метрики</b> <span className="dim">· 3 мес</span></div>
        <div className="meta mono">период: фев — апр 2026</div>
      </div>
      <div className="section-body flush">
        <div className="kpi-row">
          {ANALYTICS_KPI.map((k, i) => (
            <div key={i} className="kpi">
              <div className={`c ${k.c}`}>{k.k}</div>
              <div className={`v ${k.c}`}><Val v={k.v} fmt={k.vFormat} /></div>
              <div className={`delta ${k.deltaTone}`}>{k.delta}</div>
              <div className="s">{k.s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
