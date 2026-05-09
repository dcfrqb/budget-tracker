import { getT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/format/money";
import type { EmploymentMonthRow } from "@/lib/data/work-sources";

interface Props {
  rows: EmploymentMonthRow[];
  sourceCcy: string;
}

export async function EmploymentPlanGrid({ rows, sourceCcy }: Props) {
  const t = await getT();

  if (rows.length === 0) return null;

  return (
    <div className="section" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("income.work.detail.plan.title")}</b>
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
              {(["month", "plan", "fact", "delta"] as const).map((col) => (
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
                  {t(`income.work.detail.plan.column.${col}` as Parameters<typeof t>[0])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const deltaColor = row.delta.gte(0) ? "var(--pos)" : "var(--neg)";
              const sign = row.delta.gte(0) ? "+" : "";

              return (
                <tr
                  key={row.monthKey}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td style={{ padding: "8px var(--sp-3)", color: "var(--text)" }}>
                    {row.monthKey}
                  </td>
                  <td style={{ padding: "8px var(--sp-3)", textAlign: "right", color: "var(--muted)" }}>
                    {row.expected ? formatMoney(row.expected, sourceCcy) : "—"}
                  </td>
                  <td style={{ padding: "8px var(--sp-3)", textAlign: "right", color: "var(--text)" }}>
                    {formatMoney(row.actual, sourceCcy)}
                  </td>
                  <td style={{ padding: "8px var(--sp-3)", textAlign: "right", color: deltaColor }}>
                    {sign}{formatMoney(row.delta, sourceCcy)}
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
