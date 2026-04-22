import { INVITE } from "@/lib/mock-family";

export function InviteBanner() {
  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="invite-banner">
        <div className="ico">🔗</div>
        <div className="l">
          <div className="t">{INVITE.title}</div>
          <div className="s">{INVITE.sub}</div>
        </div>
        <span className="link mono">{INVITE.link}</span>
        <button type="button" className="btn">Копировать</button>
        <button type="button" className="btn">Отозвать</button>
      </div>
    </div>
  );
}
