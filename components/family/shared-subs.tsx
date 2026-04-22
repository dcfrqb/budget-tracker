import { SHARED_SUBS } from "@/lib/mock-family";

export function SharedSubs() {
  return (
    <div className="section fade-in" style={{ animationDelay: "360ms", marginBottom: 0 }}>
      <div className="section-hd">
        <div className="ttl mono"><b>общие подписки</b> <span className="dim">· шеринг</span></div>
        <div className="meta mono">4 шеринга · твоя доля ₽ 1 340 / мес</div>
      </div>
      <div className="section-body flush">
        {SHARED_SUBS.map((s) => (
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
      </div>
    </div>
  );
}
