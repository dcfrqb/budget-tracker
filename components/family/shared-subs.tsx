export type SharedSubSegment = { pct: number; color: string };

export type SharedSubMemberDot = { letter: string; color: string; small?: boolean };

export type SharedSubRow = {
  id: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  name: string;
  sub: string;
  badge: string;
  badgeLabel: string;
  segments: SharedSubSegment[];
  members: SharedSubMemberDot[];
  amount: string;
  your: string;
  yourTone?: "acc" | string;
};

export function SharedSubs({ rows, yourShareLabel }: { rows: SharedSubRow[]; yourShareLabel?: string }) {
  return (
    <div className="section fade-in" style={{ animationDelay: "360ms", marginBottom: 0 }}>
      <div className="section-hd">
        <div className="ttl mono"><b>общие подписки</b> <span className="dim">· шеринг</span></div>
        <div className="meta mono">
          {rows.length} шерингов
          {yourShareLabel ? ` · твоя доля ${yourShareLabel}` : ""}
        </div>
      </div>
      <div className="section-body flush">
        {rows.map((s) => (
          <div key={s.id} className="ssub-row" tabIndex={0}>
            <div className="ssub-ico" style={{ background: s.iconBg, color: s.iconColor }}>{s.icon}</div>
            <div className="ssub-main">
              <div className="n">{s.name}</div>
              <div className="m">{s.sub}</div>
            </div>
            <span className={`ssub-badge ${s.badge}`}>{s.badgeLabel}</span>
            <div className="ssub-split-vis">
              <div className="seg-bar">
                {s.segments.map((seg, i) => (
                  <span key={i} style={{ width: `${seg.pct}%`, background: seg.color }} />
                ))}
              </div>
              <div className="ssub-members">
                {s.members.map((m, i) => (
                  <span
                    key={i}
                    className="ma"
                    style={{ background: m.color, fontSize: m.small ? 8 : undefined }}
                  >
                    {m.letter}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="ssub-amt">{s.amount}</div>
              <div className="ssub-your" style={s.yourTone === "acc" ? { color: "var(--accent)" } : undefined}>{s.your}</div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button type="button" className="btn">Оплатить</button>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
            нет общих подписок
          </div>
        )}
      </div>
    </div>
  );
}
