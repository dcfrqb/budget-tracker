import { CALENDAR } from "@/lib/mock-planning";

export function PlanningCalendar() {
  return (
    <div className="section fade-in" style={{ animationDelay: "180ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>календарь событий</b> <span className="dim">· ближ. 90 дней</span></div>
        <div className="meta mono">
          <button type="button" className="btn primary" style={{ padding: "3px 9px", fontSize: 10 }}>
            + Новое событие
          </button>
        </div>
      </div>
      <div className="timeline">
        {CALENDAR.map((m) => (
          <div key={m.id} className="tl-month">
            <div className="tl-mo-label">
              {m.short}<b>{m.year}</b>
              <div className="s">{m.sub}</div>
            </div>
            <div className="tl-events">
              {m.events.map((e) => (
                <div key={e.id} className={`tl-evt ${e.kind}`} tabIndex={0}>
                  <div className="tl-date">{e.date}<b>{e.weekday}</b>{e.inDays}</div>
                  <div className={`tl-ico ${e.kind}`}>{e.letter}</div>
                  <div className="tl-main">
                    <div className="n">{e.name}</div>
                    <div className="m">{e.sub}</div>
                  </div>
                  {e.fundLabel ? (
                    <span className="tl-fund">{e.fundLabel}</span>
                  ) : (
                    <span className="tl-fund none">без фонда</span>
                  )}
                  <div className={`tl-amt ${e.amountTone ?? ""}`}>{e.amount}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
