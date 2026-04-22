import { LONG_PROJECTS } from "@/lib/mock-expenses";

export function LongProjects() {
  return (
    <div className="section fade-in" style={{ animationDelay: "240ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>долгие проекты</b> <span className="dim">· много-месячные</span>
        </div>
        <div className="meta mono">
          <button type="button" className="btn primary" style={{ padding: "3px 9px", fontSize: 10 }}>
            + Новый проект
          </button>
        </div>
      </div>
      <div className="section-body flush">
        <div className="proj-list">
          {LONG_PROJECTS.map((p) => (
            <div key={p.id} className="proj-row" tabIndex={0}>
              <div className="proj-main">
                <div className="proj-name">{p.name}</div>
                <div className="proj-sub">{p.sub}</div>
              </div>
              <div className="proj-bar">
                <div className="fill" style={{ width: `${p.pct}%` }} />
              </div>
              <div className="proj-amt">
                {p.amountSpent}{" "}
                <span className="mono" style={{ color: "var(--muted)", fontWeight: 400 }}>
                  / {p.amountTotal}
                </span>
              </div>
              <div className="proj-dates">{p.dates}</div>
              <div
                className="proj-pct"
                style={{
                  color:
                    p.pctTone === "warn" ? "var(--warn)" :
                    p.pctTone === "dim" ? "var(--dim)" :
                    undefined,
                }}
              >
                {p.pct}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
