export type ForecastCell = {
  k: string;
  v: string;
  s: string;
  vTone?: string;
};

export type ForecastLabels = {
  title: string;
  subtitle: string;
  meta: string;
  empty: string;
};

export function Forecast({ cells, labels }: { cells: ForecastCell[]; labels: ForecastLabels }) {
  return (
    <div className="section fade-in" style={{ animationDelay: "360ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{labels.title}</b> <span className="dim">&middot; {labels.subtitle}</span>
        </div>
        <div className="meta mono">{labels.meta}</div>
      </div>
      <div className="section-body flush">
        <div className="fc-row">
          {cells.map((f, i) => (
            <div key={i} className="fc-cell">
              <div className="k">{f.k}</div>
              <div className={`v ${f.vTone ?? ""}`}>{f.v}</div>
              <div className="s">{f.s}</div>
            </div>
          ))}
          {cells.length === 0 && (
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 0" }}>
              {labels.empty}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
