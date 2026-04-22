import { PIE_SLICES } from "@/lib/mock-analytics";

export function CategoryPie() {
  // perimeter 2πr with r=80 ≈ 502.65
  const P = 502.65;
  let offset = 0;
  const segments = PIE_SLICES.map((s) => {
    const len = (s.pct / 100) * P;
    const seg = { len, offset, color: s.color };
    offset += len;
    return seg;
  });

  return (
    <div className="section fade-in" style={{ animationDelay: "240ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>категории расходов</b> <span className="dim">· апрель 2026</span>
        </div>
        <div className="meta mono">12 категорий · отсорт. по сумме</div>
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
              <text x={100} y={94} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize={10} fill="#7D8898" letterSpacing={1}>ИТОГО</text>
              <text x={100} y={114} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize={16} fontWeight={700} fill="#E6EDF3">₽ 142 310</text>
            </svg>
            <div className="pie-total mono">
              <b>12 категорий</b>
              период 30д · vs марта 2026
            </div>
          </div>

          <div className="legend-cell">
            {PIE_SLICES.map((s, i) => (
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
          </div>
        </div>
      </div>
    </div>
  );
}
