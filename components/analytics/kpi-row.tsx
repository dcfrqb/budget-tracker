import { CountUp } from "@/components/count-up";

export type AnalyticsKpiItem = {
  k: string;
  v: number;
  vFormat: string;
  delta: string;
  deltaTone: string;
  s: string;
  c: string;
};

function Val({ v, fmt }: { v: number; fmt: string }) {
  if (fmt === "days") return <><CountUp to={v} format="int" /> дн</>;
  if (fmt === "money-pos") return <>+₽ <CountUp to={v} /></>;
  return <>₽ <CountUp to={v} /></>;
}

export function AnalyticsKpiRow({
  items,
  periodLabel,
}: {
  items: AnalyticsKpiItem[];
  periodLabel?: string;
}) {
  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>ключевые метрики</b> <span className="dim">· 3 мес</span></div>
        <div className="meta mono">{periodLabel ?? "текущий период"}</div>
      </div>
      <div className="section-body flush">
        <div className="kpi-row">
          {items.map((k, i) => (
            <div key={i} className="kpi">
              <div className={`c ${k.c}`}>{k.k}</div>
              <div className={`v ${k.c}`}><Val v={k.v} fmt={k.vFormat} /></div>
              <div className={`delta ${k.deltaTone}`}>{k.delta}</div>
              <div className="s">{k.s}</div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 0" }}>
              нет данных за период
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
