import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { CountUp } from "@/components/count-up";

export type IncomeKpiData = {
  ytd: { value: number; label: string; sub: string };
  sources: { value: number; label: string; sub: string };
  tax: { value: number; label: string; sub: string };
  rate: { value: number; label: string; sub: string };
};

export async function IncomeKpiRow({
  kpi,
  hasNoSources = false,
}: {
  kpi: IncomeKpiData;
  hasNoSources?: boolean;
}) {
  const t = await getT();

  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{kpi.ytd.label}</b>
        </div>
        <div className="meta mono">{kpi.sources.value}</div>
      </div>
      <div className="section-body flush">
        {hasNoSources ? (
          <div className="kpi-row">
            <div className="kpi">
              <div className="c pos">{kpi.ytd.label.toUpperCase()}</div>
              <div className="v pos">&#x20BD; <CountUp to={kpi.ytd.value} /></div>
              <div className="s">{kpi.ytd.sub}</div>
            </div>
            <div
              className="kpi"
              style={{
                gridColumn: "span 3",
                background: "var(--panel-2)",
                border: "1px solid var(--accent)",
                borderRadius: 2,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "12px 16px",
              }}
            >
              <div className="c acc">{t("income.kpi.empty_cta_title")}</div>
              <div className="s" style={{ lineHeight: 1.5 }}>
                {t("income.kpi.empty_cta_body")}
              </div>
              <Link
                href="/income/work-sources/new"
                className="btn primary"
                style={{ fontSize: 11, padding: "4px 12px", alignSelf: "flex-start", marginTop: 4 }}
              >
                {t("income.kpi.empty_cta_button")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="kpi-row">
            <div className="kpi">
              <div className="c pos">{kpi.ytd.label.toUpperCase()}</div>
              <div className="v pos">&#x20BD; <CountUp to={kpi.ytd.value} /></div>
              <div className="s">{kpi.ytd.sub}</div>
            </div>
            <div className="kpi">
              <div className="c acc">{kpi.sources.label}</div>
              <div className="v acc">{kpi.sources.value}</div>
              <div className="s">{kpi.sources.sub}</div>
            </div>
            <div className="kpi">
              <div className="c warn">{kpi.tax.label}</div>
              <div className="v warn">&#x20BD; <CountUp to={kpi.tax.value} /></div>
              <div className="s">{kpi.tax.sub}</div>
            </div>
            <div className="kpi">
              <div className="c info">{kpi.rate.label}</div>
              <div className="v">
                &#x20BD; <CountUp to={kpi.rate.value} />
                <span className="s" style={{ display: "inline", marginLeft: 4, fontSize: 12 }}> / h</span>
              </div>
              <div className="s">{kpi.rate.sub}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
