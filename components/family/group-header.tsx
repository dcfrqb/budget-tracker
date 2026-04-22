import { CountUp } from "@/components/count-up";
import { GROUP } from "@/lib/mock-family";

export function GroupHeader() {
  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>наша группа</b> <span className="dim">· «Никитины»</span></div>
        <div className="meta mono">создана {GROUP.createdAt} · {GROUP.members.length} участника</div>
      </div>
      <div className="section-body flush">
        <div className="grp-header">
          <div className="grp-main">
            <div className="n">{GROUP.name}</div>
            <div className="m">{GROUP.sub}</div>
            <div className="avatars">
              {GROUP.members.map((m, i) => (
                <span key={i} className="av" style={{ background: m.color }}>{m.letter}</span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button type="button" className="btn primary" style={{ padding: "4px 10px", fontSize: 10 }}>+ Пригласить</button>
              <button type="button" className="btn" style={{ padding: "4px 10px", fontSize: 10 }}>Настройки</button>
            </div>
          </div>
          {GROUP.stats.map((s, i) => (
            <div key={i} className="grp-cell">
              <div className="k">{s.k}</div>
              <div className={`v ${s.tone}`}>
                {s.prefix ?? "₽"} <CountUp to={s.v} />
              </div>
              <div className="s">{s.s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
