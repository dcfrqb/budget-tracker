import { FORECAST } from "@/lib/mock-analytics";

export function Forecast() {
  return (
    <div className="section fade-in" style={{ animationDelay: "360ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>прогноз</b> <span className="dim">· упрощённый · конец периода</span>
        </div>
        <div className="meta mono">без пессимистичного сценария · см. видение</div>
      </div>
      <div className="section-body flush">
        <div className="fc-row">
          {FORECAST.map((f, i) => (
            <div key={i} className="fc-cell">
              <div className="k">{f.k}</div>
              <div className={`v ${f.vTone}`}>{f.v}</div>
              <div className="s">{f.s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
