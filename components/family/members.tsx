import { MEMBERS } from "@/lib/mock-family";

export function Members() {
  return (
    <div className="section fade-in" style={{ animationDelay: "200ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>участники</b> <span className="dim">· за апрель</span></div>
        <div className="meta mono">3 / неогранич. · можно удалить любого</div>
      </div>
      <div className="section-body flush">
        <div className="mem-grid">
          {MEMBERS.map((m) => (
            <div key={m.id} className="mem-card">
              <div className="mem-top">
                <div className="mem-av" style={{ background: m.color }}>{m.letter}</div>
                <div className="mem-info">
                  <div className="n">{m.name}</div>
                  <div className="m">
                    <span className={`mem-role ${m.role}`}>{m.roleLabel}</span>
                    <span>{m.since}</span>
                  </div>
                </div>
              </div>
              <div className="mem-stats">
                {m.stats.map((s, i) => (
                  <div key={i}>
                    <div className="k">{s.k}</div>
                    <div className={`v ${s.tone ?? ""}`}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div className="mem-balance">
                <span className="k">{m.balK}</span>
                <span className={`v ${m.balTone}`}>{m.balV}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
