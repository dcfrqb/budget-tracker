import type { BurnRate, ShrinkableCategory } from "@/lib/data/analytics-prescriptive";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type PrescriptiveLabels = {
  title: string;
  subtitle: string;
  meta: string;
  burn: {
    title: string;
    per_day_30: string;
    per_day_90: string;
    days_to_zero: string;
    days_to_zero_sub: string;
    already_negative: string;
    no_burn: string;
  };
  shrink: {
    title: string;
    subtitle: string;
    col_current: string;
    col_avg: string;
    col_over: string;
    empty: string;
  };
};

type Props = {
  burn: BurnRate;
  shrinkable: ShrinkableCategory[];
  labels: PrescriptiveLabels;
  // Pre-formatted money strings passed from page (server component)
  burnFormatted: {
    perDay30: string;
    perDay90: string;
    daysToZero: string;
    daysToZeroTone: string;
  };
  shrinkFormatted: Array<{
    name: string;
    icon: string | null;
    current: string;
    avg: string;
    over: string;
    overPct: string;
  }>;
};

// ─────────────────────────────────────────────────────────────
// Component (server)
// ─────────────────────────────────────────────────────────────

export function Prescriptive({ burn, shrinkable, labels, burnFormatted, shrinkFormatted }: Props) {
  const daysToZeroSub = burn.alreadyNegative
    ? labels.burn.already_negative
    : burn.daysToZero === null
      ? labels.burn.no_burn
      : labels.burn.days_to_zero_sub;

  const daysToZeroTone = burnFormatted.daysToZeroTone;

  return (
    <div className="section fade-in" style={{ animationDelay: "420ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{labels.title}</b>{" "}
          <span className="dim">&middot; {labels.subtitle}</span>
        </div>
        <div className="meta mono">{labels.meta}</div>
      </div>
      <div className="section-body flush">

        {/* Burn rate block */}
        <div className="fc-row">
          <div className="fc-cell">
            <div className="k">{labels.burn.per_day_30}</div>
            <div className="v">{burnFormatted.perDay30}</div>
            <div className="s">{labels.burn.title}</div>
          </div>
          <div className="fc-cell">
            <div className="k">{labels.burn.per_day_90}</div>
            <div className="v">{burnFormatted.perDay90}</div>
            <div className="s">{labels.burn.title}</div>
          </div>
          <div className="fc-cell">
            <div className="k">{labels.burn.days_to_zero}</div>
            <div className={`v ${daysToZeroTone}`}>{burnFormatted.daysToZero}</div>
            <div className="s">{daysToZeroSub}</div>
          </div>
        </div>

        {/* Shrinkable categories block */}
        <div style={{ marginTop: "var(--space-3)" }}>
          <div className="ttl mono" style={{ fontSize: 11, marginBottom: "var(--space-2)" }}>
            {labels.shrink.title}{" "}
            <span className="dim">&middot; {labels.shrink.subtitle}</span>
          </div>
          {shrinkFormatted.length === 0 ? (
            <div
              className="mono"
              style={{ fontSize: 12, color: "var(--muted)", padding: "8px 0" }}
            >
              {labels.shrink.empty}
            </div>
          ) : (
            <div className="period-stats">
              {shrinkFormatted.map((row, i) => (
                <div key={i} className="r">
                  <span className="k">
                    {row.icon ? `${row.icon} ` : ""}{row.name}
                  </span>
                  <span className="v">
                    <span style={{ color: "var(--muted)", marginRight: "var(--space-1)" }}>
                      {row.current}
                    </span>
                    <span
                      className="neg"
                      style={{
                        fontSize: 11,
                        padding: "1px 4px",
                        border: "1px solid var(--neg)",
                        borderRadius: 2,
                      }}
                    >
                      ▲ {row.overPct}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
