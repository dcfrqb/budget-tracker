import { CMP_ROWS } from "@/lib/mock-analytics";

export function Compare() {
  return (
    <div className="section fade-in" style={{ animationDelay: "300ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>сравнение с прошлым периодом</b> <span className="dim">· апр vs мар</span>
        </div>
        <div className="meta mono">6 категорий растут · 4 падают · 2 без изменений</div>
      </div>
      <div className="section-body flush">
        <div className="cmp-grid">
          <div className="cmp-hd">
            <div>Категория</div>
            <div style={{ textAlign: "right" }}>март 2026</div>
            <div style={{ textAlign: "right" }}>апрель 2026</div>
            <div style={{ textAlign: "right" }}>Δ %</div>
            <div style={{ textAlign: "right" }}>тренд 6м</div>
          </div>
          {CMP_ROWS.map((r, i) => (
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
        </div>
      </div>
    </div>
  );
}
