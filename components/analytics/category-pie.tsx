export type PieSliceView = {
  name: string;
  sub: string;
  amount: string;
  pct: number;
  color: string;
  delta: string;
  deltaTone: string;
};

export type CategoryPieLabels = {
  title: string;
  periodDefault: string;
  meta: string;
  totalLabel: string;
  legendPeriod: string;
  legendPeriodDefault: string;
  empty: string;
};

export function CategoryPie({
  slices,
  totalLabel,
  periodLabel,
  labels,
}: {
  slices: PieSliceView[];
  totalLabel?: string;
  periodLabel?: string;
  labels: CategoryPieLabels;
}) {
  // perimeter 2πr with r=80 ≈ 502.65
  const P = 502.65;
  let offset = 0;
  const segments = slices.map((s) => {
    const len = (s.pct / 100) * P;
    const seg = { len, offset, color: s.color };
    offset += len;
    return seg;
  });

  return (
    <div className="section fade-in" style={{ animationDelay: "240ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{labels.title}</b>{" "}
          <span className="dim">· {periodLabel ?? labels.periodDefault}</span>
        </div>
        <div className="meta mono">{labels.meta}</div>
      </div>
      <div className="section-body flush">
        <div className="cat-breakdown">
          <div className="pie-cell">
            <svg viewBox="0 0 200 200" width={200} height={200}>
              <g transform="translate(100 100) rotate(-90)">
                <circle r={80} fill="none" stroke="var(--panel)" strokeWidth={28} />
                {segments.map((seg, i) => (
                  <circle
                    key={i}
                    r={80} fill="none"
                    stroke={seg.color}
                    strokeWidth={28}
                    strokeDasharray={`${seg.len} ${P}`}
                    strokeDashoffset={-seg.offset}
                  />
                ))}
              </g>
              <text x={100} y={94} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize={10} fill="#7D8898" letterSpacing={1}>{labels.totalLabel}</text>
              <text x={100} y={114} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize={16} fontWeight={700} fill="#E6EDF3">{totalLabel ?? "—"}</text>
            </svg>
            <div className="pie-total mono">
              <b>{labels.meta}</b>
              {periodLabel ? labels.legendPeriod.replace("{period}", periodLabel) : labels.legendPeriodDefault}
            </div>
          </div>

          <div className="legend-cell">
            {slices.map((s, i) => (
              <div key={i} className="lg-row">
                <span className="lg-sw" style={{ background: s.color }} />
                <div>
                  <div className="lg-name">{s.name}</div>
                  <div className="lg-sub">{s.sub}</div>
                </div>
                <div className="lg-amt">{s.amount}</div>
                <div className={`lg-delta ${s.deltaTone}`}>{s.delta}</div>
              </div>
            ))}
            {slices.length === 0 && (
              <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 0" }}>
                {labels.empty}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
