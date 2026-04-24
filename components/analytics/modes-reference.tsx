export type ModeLimit = { k: string; v: string };

export type ModeCard = {
  id: string;
  name: string;
  tag: string;
  active: boolean;
  limits: ModeLimit[];
  safeDays: string;
  safeColor: string;
};

export function ModesReference({ modes, activeMode }: { modes: ModeCard[]; activeMode?: string }) {
  return (
    <div className="section fade-in" style={{ animationDelay: "420ms", marginBottom: 0 }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>режимы · справка</b>{" "}
          <span className="dim">· только просмотр · переключать на главной</span>
        </div>
        <div className="meta mono">
          {activeMode ? (
            <>активен: <span className="pos">{activeMode}</span></>
          ) : (
            "не задан"
          )}
        </div>
      </div>
      <div className="section-body flush">
        <div className="mode-grid">
          {modes.map((m) => (
            <div key={m.id} className={`mode-card ${m.id}${m.active ? " active" : ""}`}>
              <div className="mode-hd">
                <div className="mode-name">{m.name}</div>
                <span className="mode-active-pill">{m.active ? "активен" : "выкл"}</span>
              </div>
              <div className="tag mono">{m.tag}</div>
              <div className="mode-limits">
                {m.limits.map((l, i) => (
                  <div key={i} className="r">
                    <span>{l.k}</span>
                    <b>{l.v}</b>
                  </div>
                ))}
              </div>
              <div className="safe">
                <span className="k">безопасно до</span>
                <span className="v" style={{ color: m.safeColor }}>{m.safeDays}</span>
              </div>
            </div>
          ))}
          {modes.length === 0 && (
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 0" }}>
              режимы не настроены
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
