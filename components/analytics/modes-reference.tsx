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

export type ModesReferenceLabels = {
  title: string;
  subtitle: string;
  active_on: string;
  active_off: string;
  pill_on: string;
  pill_off: string;
  safe_until_label: string;
  empty: string;
};

export function ModesReference({
  modes,
  activeMode,
  labels,
}: {
  modes: ModeCard[];
  activeMode?: string;
  labels: ModesReferenceLabels;
}) {
  return (
    <div className="section fade-in" style={{ animationDelay: "420ms", marginBottom: 0 }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{labels.title}</b>{" "}
          <span className="dim">&middot; {labels.subtitle}</span>
        </div>
        <div className="meta mono">
          {activeMode ? (
            <>{labels.active_on}</>
          ) : (
            labels.active_off
          )}
        </div>
      </div>
      <div className="section-body flush">
        <div className="mode-grid">
          {modes.map((m) => (
            <div key={m.id} className={`mode-card ${m.id}${m.active ? " active" : ""}`}>
              <div className="mode-hd">
                <div className="mode-name">{m.name}</div>
                <span className="mode-active-pill">{m.active ? labels.pill_on : labels.pill_off}</span>
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
                <span className="k">{labels.safe_until_label}</span>
                <span className="v" style={{ color: m.safeColor }}>{m.safeDays}</span>
              </div>
            </div>
          ))}
          {modes.length === 0 && (
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 0" }}>
              {labels.empty}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
