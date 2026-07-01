import { getT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/format/money";
import { resolveTariffLabel } from "@/lib/format/business-labels";
import type { BusinessTariffBreakdownRow } from "@/lib/data/businesses";

interface Props {
  rows: BusinessTariffBreakdownRow[];
  currencyCode: string;
}

export async function TariffBreakdown({ rows, currencyCode }: Props) {
  const t = await getT();

  if (rows.length === 0) return null;

  return (
    <div className="section" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("business.detail.tariff_breakdown.title")}</b>
        </div>
      </div>
      <div className="section-body flush">
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "var(--text-xs)",
            fontFamily: "var(--mono-font), monospace",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th
                style={{
                  padding: "6px var(--sp-3)",
                  textAlign: "left",
                  color: "var(--muted)",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {t("business.detail.tariff_breakdown.column.tariff")}
              </th>
              <th
                style={{
                  padding: "6px var(--sp-3)",
                  textAlign: "right",
                  color: "var(--muted)",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {t("business.detail.tariff_breakdown.column.total")}
              </th>
              <th
                style={{
                  padding: "6px var(--sp-3)",
                  textAlign: "right",
                  color: "var(--muted)",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {t("business.detail.tariff_breakdown.column.count")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.tariff} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "8px var(--sp-3)", color: "var(--text)" }}>
                  {resolveTariffLabel(t, row.tariff)}
                </td>
                <td style={{ padding: "8px var(--sp-3)", textAlign: "right", color: "var(--pos)" }}>
                  {formatMoney(row.total, currencyCode)}
                </td>
                <td style={{ padding: "8px var(--sp-3)", textAlign: "right", color: "var(--muted)" }}>
                  {row.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
