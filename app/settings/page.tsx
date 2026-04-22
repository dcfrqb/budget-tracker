export default function SettingsPage() {
  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>настройки</b> <span className="dim">· заглушка</span>
        </div>
        <div className="meta mono">скоро</div>
      </div>
      <div className="section-body">
        <div className="mono" style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.7 }}>
          Профиль, источники дохода, налоговая ставка, валюта по умолчанию, языки,
          horkeys, темы, экспорт данных, управление группой. Соберём после того,
          как первые 8 вкладок отработают в реальных сценариях.
        </div>
      </div>
    </div>
  );
}
