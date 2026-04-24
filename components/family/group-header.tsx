import { CountUp } from "@/components/count-up";

export type GroupMemberAvatar = {
  letter: string;
  color: string;
};

export type GroupStat = {
  k: string;
  v: number;
  tone: string;
  s: string;
  prefix?: string;
};

export type GroupHeaderData = {
  name: string;
  sub: string;
  createdAt: string;
  members: GroupMemberAvatar[];
  stats: GroupStat[];
};

export function GroupHeader({ group }: { group?: GroupHeaderData }) {
  if (!group) {
    return (
      <div className="section fade-in" style={{ animationDelay: "60ms" }}>
        <div className="section-hd">
          <div className="ttl mono"><b>наша группа</b> <span className="dim">· не создана</span></div>
          <div className="meta mono">
            <button type="button" className="btn primary" style={{ padding: "3px 9px", fontSize: 10 }}>
              + Создать группу
            </button>
          </div>
        </div>
        <div className="section-body flush">
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
            нет активной семейной группы · создай первую
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>наша группа</b> <span className="dim">· «{group.name}»</span></div>
        <div className="meta mono">создана {group.createdAt} · {group.members.length} участника</div>
      </div>
      <div className="section-body flush">
        <div className="grp-header">
          <div className="grp-main">
            <div className="n">{group.name}</div>
            <div className="m">{group.sub}</div>
            <div className="avatars">
              {group.members.map((m, i) => (
                <span key={i} className="av" style={{ background: m.color }}>{m.letter}</span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button type="button" className="btn primary" style={{ padding: "4px 10px", fontSize: 10 }}>+ Пригласить</button>
              <button type="button" className="btn" style={{ padding: "4px 10px", fontSize: 10 }}>Настройки</button>
            </div>
          </div>
          {group.stats.map((s, i) => (
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
