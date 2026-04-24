export type MemberStat = { k: string; v: string; tone?: string };

export type MemberCardView = {
  id: string;
  letter: string;
  color: string;
  name: string;
  role: string;
  roleLabel: string;
  since: string;
  stats: MemberStat[];
  balK: string;
  balV: string;
  balTone: string;
};

export function Members({ members, periodLabel }: { members: MemberCardView[]; periodLabel?: string }) {
  return (
    <div className="section fade-in" style={{ animationDelay: "200ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>участники</b>{" "}
          <span className="dim">· {periodLabel ?? "текущий месяц"}</span>
        </div>
        <div className="meta mono">{members.length} / неогранич.</div>
      </div>
      <div className="section-body flush">
        <div className="mem-grid">
          {members.map((m) => (
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
          {members.length === 0 && (
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
              нет участников
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
