import { getT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/format/money";
import { resolveTariffLabel } from "@/lib/format/business-labels";
import { BUSINESS_CHART_COLORS } from "@/lib/charts/business-colors";
import type { BusinessTariffBreakdownRow } from "@/lib/data/businesses";

interface Props {
  rows: BusinessTariffBreakdownRow[];
  currencyCode: string;
}

export async function TariffChart({ rows, currencyCode }: Props) {
  const t = await getT();

  const meaningfulRows = rows.filter((r) => r.total.gt(0));

  return (
    <div className="section fade-in" style={{ animationDelay: "140ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("business.detail.charts.tariff.title")}</b>
        </div>
      </div>
      <div className="section-body flush">
        {meaningfulRows.length === 0 ? (
          <div
            className="mono dim"
            style={{ padding: "var(--sp-4) var(--sp-3)", fontSize: "var(--text-sm)", textAlign: "center" }}
          >
            {t("business.detail.charts.tariff.empty")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", padding: "var(--sp-3)" }}>
            {(() => {
              const maxTotal = Math.max(...meaningfulRows.map((r) => Number(r.total)));
              return meaningfulRows.map((row, i) => {
                const pct = maxTotal > 0 ? (Number(row.total) / maxTotal) * 100 : 0;
                const color = BUSINESS_CHART_COLORS[i % BUSINESS_CHART_COLORS.length];
                return (
                  <div key={row.tariff} className="mono" style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", alignItems: "center", gap: "var(--sp-3)", fontSize: "var(--text-xs)" }}>
                    <span style={{ color: "var(--text)" }}>{resolveTariffLabel(t, row.tariff)}</span>
                    <div style={{ background: "var(--panel)", height: "10px", position: "relative" }}>
                      <div style={{ background: color, height: "100%", width: `${pct}%` }} />
                    </div>
                    <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {formatMoney(row.total, currencyCode)} · {row.count}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
