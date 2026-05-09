import { getT, getLocale } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/format/money";
import { formatShortDate } from "@/lib/format/date";
import type { SyntheticForecastEntry } from "@/lib/data/work-sources";

interface Props {
  entries: SyntheticForecastEntry[];
}

export async function SyntheticForecastBlock({ entries }: Props) {
  if (entries.length === 0) return null;

  const [t, locale] = await Promise.all([getT(), getLocale()]);

  return (
    <div className="section" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("income.work.detail.forecast.title")}</b>
        </div>
        <div
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--muted)",
            fontFamily: "var(--mono-font), monospace",
          }}
        >
          {t("income.work.detail.forecast.note")}
        </div>
      </div>
      <div className="section-body">
        {entries.map((entry, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "var(--sp-2) var(--sp-3)",
              borderBottom: i < entries.length - 1 ? "1px solid var(--grid)" : undefined,
            }}
          >
            <span
              className="mono"
              style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}
            >
              {formatShortDate(entry.expectedAt, locale)}
            </span>
            <span
              className="mono"
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 700,
                color: "var(--pos)",
              }}
            >
              {formatMoney(entry.amount, entry.currencyCode)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
