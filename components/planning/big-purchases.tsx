import { BIG_PURCHASES } from "@/lib/mock-planning";

export function BigPurchases() {
  return (
    <div className="section fade-in" style={{ animationDelay: "300ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>крупные покупки · прогресс</b></div>
        <div className="meta mono">4 запланировано · часы посчитаны от ставки ₽ 1 180/ч</div>
      </div>
      <div className="section-body flush">
        {BIG_PURCHASES.map((p) => (
          <div key={p.id} className="bp-row" tabIndex={0}>
            <div className="bp-ico">{p.icon}</div>
            <div className="bp-main">
              <div className="bp-name">{p.name}</div>
              <div className="bp-sub">{p.sub}</div>
            </div>
            <div className="bp-target">срок<b>{p.dueLabel}</b></div>
            <div className="bp-bar"><div className="fill" style={{ width: `${p.pct}%` }} /></div>
            <div className="bp-hrs">
              {p.hoursMain}
              <br />
              <span style={{ color: "var(--muted)", fontWeight: 400 }}>{p.hoursSub}</span>
            </div>
            <div
              className="bp-pct"
              style={{
                color:
                  p.pctTone === "warn" ? "var(--warn)" :
                  p.pctTone === "dim"  ? "var(--dim)"  :
                  undefined,
              }}
            >
              {p.pct}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
