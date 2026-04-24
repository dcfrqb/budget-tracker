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
}: {
  rows: CompareRow[];
  currentPeriodLabel?: string;
  previousPeriodLabel?: string;
}) {
  const rising = rows.filter((r) => r.deltaTone === "neg").length;
  const falling = rows.filter((r) => r.deltaTone === "pos").length;

  return (
    <div className="section fade-in" style={{ animationDelay: "300ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>сравнение с прошлым периодом</b>{" "}
          <span className="dim">· {previousPeriodLabel ?? "прошлый"} vs {currentPeriodLabel ?? "текущий"}</span>
        </div>
        <div className="meta mono">
          {rising > 0 ? `${rising} категорий растут` : ""}
          {rising > 0 && falling > 0 ? " · " : ""}
          {falling > 0 ? `${falling} падают` : ""}
          {rows.length === 0 ? "нет данных" : ""}
        </div>
      </div>
      <div className="section-body flush">
        <div className="cmp-grid">
          <div className="cmp-hd">
            <div>Категория</div>
            <div style={{ textAlign: "right" }}>{previousPeriodLabel ?? "прошлый"}</div>
            <div style={{ textAlign: "right" }}>{currentPeriodLabel ?? "текущий"}</div>
            <div style={{ textAlign: "right" }}>Δ %</div>
            <div style={{ textAlign: "right" }}>тренд 6м</div>
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
              нет данных для сравнения
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
