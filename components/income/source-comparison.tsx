import { getT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/format/money";
import { Prisma } from "@prisma/client";
import type { SourceComparisonRow } from "@/lib/data/work-sources";

interface Props {
  rows: SourceComparisonRow[];
  baseCcy: string;
}

function barColor(kind: SourceComparisonRow["kind"]): string {
  switch (kind) {
    case "FREELANCE":   return "var(--accent)";
    case "EMPLOYMENT":  return "var(--pos)";
    case "ONE_TIME":    return "var(--muted)";
  }
}

export async function SourceComparison({ rows, baseCcy }: Props) {
  const t = await getT();

  if (rows.length < 2) return null;

  const maxBase = rows.reduce(
    (m, r) => (r.totalBase.gt(m) ? r.totalBase : m),
    new Prisma.Decimal(0),
  );

  return (
    <div className="src-cmp-strip">
      <div
        className="ttl mono"
        style={{ marginBottom: "var(--sp-3)", fontSize: "var(--text-xs)", color: "var(--muted)" }}
      >
        {t("income.sources.comparison.title")}
      </div>
      {rows.map((row) => {
        const widthPct = maxBase.isZero()
          ? 0
          : row.totalBase.div(maxBase).times(100).toNumber();

        return (
          <div key={row.id} className="src-cmp-row">
            <span
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.name}
            </span>
            <div className="src-cmp-bar-track">
              <div
                className="src-cmp-bar-fill"
                style={{
                  width: `${Math.max(widthPct, 0)}%`,
                  minWidth: row.totalBase.gt(0) ? "2px" : "0",
                  background: barColor(row.kind),
                }}
              />
            </div>
            <span
              className="mono"
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text)",
                textAlign: "right",
                whiteSpace: "nowrap",
              }}
            >
              {formatMoney(row.totalNative, row.currencyCode)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
