export type CompareRow = {
  name: string;
  sub: string;
  prev: string;
  curr: string;
  delta: string;
  deltaTone: string;
  spark: number[];
};

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
          <b>{labels.title}</b>{" "}
          <span className="dim">· {caption}</span>
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
                <div className="num">{r.prev}</div>
                <div className="num">{r.curr}</div>
                <div className={`delta ${r.deltaTone}`}>{r.delta}</div>
                <div className="spark">
                  {r.spark.map((h, j) => (
                    <span key={j} style={{ height: h }} />
                  ))}
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
                {labels.empty}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
