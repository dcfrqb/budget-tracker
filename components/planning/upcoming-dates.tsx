import { UPCOMING_BH } from "@/lib/mock-planning";

export function UpcomingDates() {
  return (
    <div className="section fade-in" style={{ animationDelay: "360ms", marginBottom: 0 }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>ближайшие даты</b> <span className="dim">· автопредложение отложить</span>
        </div>
        <div className="meta mono">8 событий · ₽ 43к ориентир</div>
      </div>
      <div className="bh-row">
        {UPCOMING_BH.map((b) => (
          <div key={b.id} className="bh-pill">
            <div className="bh-date">{b.day}<b>{b.mo}</b></div>
            <div className="bh-info">
              <div className="n">{b.n}</div>
              <div className="m">{b.m}</div>
            </div>
            <span className="bh-amt">{b.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
