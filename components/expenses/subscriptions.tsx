import { SUBSCRIPTIONS } from "@/lib/mock-expenses";

export function Subscriptions() {
  return (
    <div className="section fade-in" style={{ animationDelay: "180ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>подписки</b> <span className="dim">· 8 активно · ₽ 4 890/мес</span>
        </div>
        <div className="meta mono">
          <span style={{ color: "var(--muted)" }}>только ты ₽ 2 900</span> ·{" "}
          <span style={{ color: "var(--info)" }}>шеринг ₽ 1 340</span> ·{" "}
          <span style={{ color: "var(--accent)" }}>за других ₽ 650</span>
          <button type="button" className="btn primary" style={{ padding: "3px 9px", fontSize: 10, marginLeft: 10 }}>
            + Добавить
          </button>
        </div>
      </div>
      <div className="section-body flush">
        <div className="sub-grid">
          {SUBSCRIPTIONS.map((s) => (
            <article key={s.id} className="sub-card" tabIndex={0}>
              <div className="sub-top">
                <div className="sub-ico" style={{ background: s.iconBg, color: s.iconColor }}>{s.icon}</div>
                <span className={`sub-badge ${s.badge}`}>{s.badgeLabel}</span>
              </div>
              <div>
                <div className="sub-name">{s.name}</div>
                <div className="sub-meta">
                  <span>{s.period}</span>
                  <span>{s.note}</span>
                </div>
              </div>
              <div className="sub-foot">
                <span className="sub-amt">
                  {s.amount}
                  {s.share && (
                    <span className="mono" style={{ color: s.shareTone === "acc" ? "var(--accent)" : "var(--muted)", fontSize: 11, fontWeight: 400, marginLeft: 5 }}>
                      {s.share}
                    </span>
                  )}
                </span>
                <span className={`sub-next${s.nextTone === "ok" ? " ok" : ""}`}>{s.next}</span>
              </div>
              <div className="sub-btns">
                <button type="button" className="btn" style={{ flex: 1 }}>{s.primaryLabel ?? "Отметить"}</button>
                <button type="button" className="btn">⋯</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
