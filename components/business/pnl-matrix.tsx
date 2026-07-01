import { getT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/format/money";
import type { BusinessPnLRow } from "@/lib/data/businesses";

interface Props {
  rows: BusinessPnLRow[];
  currencyCode: string;
}

const COLUMNS = ["month", "revenue", "pass_through", "expenses", "profit", "cumulative"] as const;

export async function PnLMatrix({ rows, currencyCode }: Props) {
  const t = await getT();

  if (rows.length === 0) return null;

  return (
    <div className="section" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("business.detail.matrix.title")}</b>
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
              {COLUMNS.map((col) => (
                <th
                  key={col}
                  style={{
                    padding: "6px var(--sp-3)",
                    textAlign: col === "month" ? "left" : "right",
                    color: "var(--muted)",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {t(`business.detail.matrix.column.${col}` as Parameters<typeof t>[0])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const profitColor = row.profit.gte(0) ? "var(--pos)" : "var(--neg)";
              const cumulativeColor = row.cumulativeProfit.gte(0) ? "var(--pos)" : "var(--neg)";

              return (
                <tr key={row.monthKey} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px var(--sp-3)", color: "var(--text)" }}>{row.monthKey}</td>
                  <td style={{ padding: "8px var(--sp-3)", textAlign: "right", color: "var(--text)" }}>
                    {formatMoney(row.revenue, currencyCode)}
                  </td>
                  <td style={{ padding: "8px var(--sp-3)", textAlign: "right", color: "var(--muted)" }}>
                    {row.passThrough.gt(0) ? formatMoney(row.passThrough, currencyCode) : "—"}
                  </td>
                  <td style={{ padding: "8px var(--sp-3)", textAlign: "right", color: "var(--warn)" }}>
                    {formatMoney(row.expenses, currencyCode)}
                  </td>
                  <td style={{ padding: "8px var(--sp-3)", textAlign: "right", color: profitColor }}>
                    {formatMoney(row.profit, currencyCode)}
                  </td>
                  <td style={{ padding: "8px var(--sp-3)", textAlign: "right", color: cumulativeColor }}>
                    {formatMoney(row.cumulativeProfit, currencyCode)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
