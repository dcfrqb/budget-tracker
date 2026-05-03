"use client";

import { CountUp } from "@/components/count-up";
import { useT } from "@/lib/i18n/context";

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
  const t = useT();
  if (fmt === "days") return <><CountUp to={v} format="int" /> {t("common.unit.day")}</>;
  if (fmt === "money-pos") return <>+₽ <CountUp to={v} /></>;
  if (fmt === "money-neg") return <>{"−"}₽ <CountUp to={v} /></>;
  return <>₽ <CountUp to={v} /></>;
}

export function AnalyticsKpiRow({
  items,
  periodLabel,
  periodShort,
}: {
  items: AnalyticsKpiItem[];
  periodLabel?: string;
  periodShort?: string;
}) {
  const t = useT();
  const periodDim = periodShort
    ? t("analytics.kpi.title_period", { vars: { period: periodShort } })
    : "";
  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>{t("analytics.kpi.title")}</b>{periodDim ? <span className="dim"> {periodDim}</span> : null}</div>
        <div className="meta mono">{periodLabel ?? t("analytics.kpi.period_default")}</div>
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
              {t("analytics.kpi.no_data")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
