export type CompareRow = {
  name: string;
  sub: string;
  prev: string;
  curr: string;
  delta: string;
  deltaTone: string;
  /** "new" = appeared this period, "gone" = disappeared, "delta" = normal comparison */
  kind?: "new" | "gone" | "delta";
  /** Monthly expense series for last 6 months, oldest→newest (raw amounts, not normalized) */
  spark?: number[];
};

function MiniSparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min;
  const w = 56;
  const h = 24;
  const step = w / (points.length - 1);
  const norm = range === 0
    ? points.map(() => 0.5)
    : points.map((v) => (v - min) / range);
  const coords = norm
    .map((v, i) => `${(i * step).toFixed(1)},${(h - v * (h - 4) - 2).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      preserveAspectRatio="none"
      aria-hidden
      style={{ display: "block" }}
    >
      <polyline
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.2}
        points={coords}
      />
    </svg>
  );
}

export function Compare({
  rows,
  currentPeriodLabel,
  previousPeriodLabel,
  compareMode,
  captionLabel,
  labels,
}: {
  rows: CompareRow[];
  currentPeriodLabel?: string;
  previousPeriodLabel?: string;
  compareMode?: string;
  captionLabel?: string;
  labels: {
    title: string;
    disabled: string;
    noDataShort: string;
    empty: string;
    summaryRising: (count: number) => string;
    summaryFalling: (count: number) => string;
    colCategory: string;
    colPreviousDefault: string;
    colCurrentDefault: string;
    colTrend6m: string;
    deltaNew: string;
    deltaGone: string;
  };
}) {
  const rising = rows.filter((r) => r.deltaTone === "neg").length;
  const falling = rows.filter((r) => r.deltaTone === "pos").length;

  const caption = captionLabel ?? (previousPeriodLabel
    ? `${previousPeriodLabel} vs ${currentPeriodLabel}`
    : currentPeriodLabel ?? "");

  return (
    <div className="section fade-in" style={{ animationDelay: "300ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{labels.title}</b>
          {caption && (
            <div className="dim" style={{ fontSize: "var(--text-xs)", fontWeight: 400, marginTop: 2 }}>
              {caption}
            </div>
          )}
        </div>
        <div className="meta mono">
          {compareMode === "none"
            ? labels.disabled
            : (
              <>
                {rising > 0 ? labels.summaryRising(rising) : ""}
                {rising > 0 && falling > 0 ? " · " : ""}
                {falling > 0 ? labels.summaryFalling(falling) : ""}
                {rows.length === 0 ? labels.noDataShort : ""}
              </>
            )}
        </div>
      </div>
      {compareMode !== "none" && (
        <div className="section-body flush">
          <div className="cmp-grid">
            <div className="cmp-hd">
              <div>{labels.colCategory}</div>
              <div style={{ textAlign: "right" }}>{previousPeriodLabel ?? labels.colPreviousDefault}</div>
              <div style={{ textAlign: "right" }}>{currentPeriodLabel ?? labels.colCurrentDefault}</div>
              <div style={{ textAlign: "right" }}>Δ %</div>
              <div style={{ textAlign: "right" }}>{labels.colTrend6m}</div>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="cmp-row">
                <div className="name">
                  {r.name}
                  <div className="s">{r.sub}</div>
                </div>
                <div className="num money">{r.prev}</div>
                <div className="num money">{r.curr}</div>
                <div className={`delta ${r.kind === "new" ? "acc" : r.kind === "gone" ? "mut" : r.deltaTone}`}>
                  {r.kind === "new" ? (
                    <>
                      <span className="cmp-new-tag">{labels.deltaNew}</span>
                      <span className="money" style={{ color: "var(--text)" }}>{r.curr}</span>
                    </>
                  ) : r.kind === "gone" ? labels.deltaGone : r.delta}
                </div>
                <div className="cmp-spark">
                  {r.spark && r.spark.length >= 2 && <MiniSparkline points={r.spark} />}
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--muted)", padding: "12px 20px" }}>
                {labels.empty}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
