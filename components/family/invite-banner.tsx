export type InviteBannerData = {
  title: string;
  sub: string;
  link: string;
};

export function InviteBanner({ invite }: { invite?: InviteBannerData }) {
  if (!invite) return null;

  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="invite-banner">
        <div className="ico" aria-hidden>🔗</div>
        <div className="l">
          <div className="t">{invite.title}</div>
          <div className="s">{invite.sub}</div>
        </div>
        <span className="link mono">{invite.link}</span>
        <button type="button" className="btn">Копировать</button>
        <button type="button" className="btn">Отозвать</button>
      </div>
    </div>
  );
}
