import { getT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/format/money";
import { resolveStreamLabel } from "@/lib/format/business-labels";
import type { BusinessStreamMatrix } from "@/lib/data/businesses";

interface Props {
  matrix: BusinessStreamMatrix;
  currencyCode: string;
}

export async function StreamMatrix({ matrix, currencyCode }: Props) {
  const t = await getT();

  if (matrix.streams.length === 0) return null;

  return (
    <div className="section" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("business.detail.stream_matrix.title")}</b>
        </div>
      </div>
      <div className="section-body flush" style={{ overflowX: "auto" }}>
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
                {t("business.detail.stream_matrix.column.stream")}
              </th>
              {matrix.months.map((m) => (
                <th
                  key={m}
                  style={{
                    padding: "6px var(--sp-3)",
                    textAlign: "right",
                    color: "var(--muted)",
                    fontWeight: 500,
                  }}
                >
                  {m}
                </th>
              ))}
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
                {t("business.detail.stream_matrix.column.total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.streams.map((stream) => (
              <tr key={stream} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "8px var(--sp-3)", color: "var(--text)" }}>
                  {resolveStreamLabel(t, stream)}
                </td>
                {matrix.months.map((m) => {
                  const v = matrix.cells[stream][m];
                  return (
                    <td key={m} style={{ padding: "8px var(--sp-3)", textAlign: "right", color: "var(--text)" }}>
                      {v.gt(0) ? formatMoney(v, currencyCode) : "—"}
                    </td>
                  );
                })}
                <td style={{ padding: "8px var(--sp-3)", textAlign: "right", color: "var(--pos)" }}>
                  {formatMoney(matrix.streamTotals[stream], currencyCode)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ padding: "8px var(--sp-3)", color: "var(--muted)", fontWeight: 500 }}>
                {t("business.detail.stream_matrix.column.total")}
              </td>
              {matrix.months.map((m) => (
                <td key={m} style={{ padding: "8px var(--sp-3)", textAlign: "right", color: "var(--muted)" }}>
                  {formatMoney(matrix.monthTotals[m], currencyCode)}
                </td>
              ))}
              <td style={{ padding: "8px var(--sp-3)", textAlign: "right", color: "var(--pos)", fontWeight: 500 }}>
                {formatMoney(matrix.grandTotal, currencyCode)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
