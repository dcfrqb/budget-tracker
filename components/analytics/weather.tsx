export function Weather() {
  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>финансовая погода</b> <span className="dim">· здоровье финансов</span></div>
        <div className="meta mono">пересчёт раз в час · ведущий индикатор</div>
      </div>
      <div className="weather">
        <div className="wx-hero">
          <div className="wx-label">статус</div>
          <div className="wx-icon" aria-hidden>
            <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
              <circle cx="50" cy="50" r="16" fill="rgba(88,211,163,.12)" stroke="var(--accent)" />
              <line x1="50" y1="20" x2="50" y2="26" />
              <line x1="50" y1="74" x2="50" y2="80" />
              <line x1="20" y1="50" x2="26" y2="50" />
              <line x1="74" y1="50" x2="80" y2="50" />
              <line x1="28" y1="28" x2="33" y2="33" />
              <line x1="67" y1="67" x2="72" y2="72" />
              <line x1="72" y1="28" x2="67" y2="33" />
              <line x1="33" y1="67" x2="28" y2="72" />
            </svg>
          </div>
          <div className="wx-status">Солнечно</div>
          <div className="wx-sub mono">сохраняется 9 недель подряд · тренд стабильный</div>
        </div>

        <div className="wx-cells">
          <div className="k">шкала состояния</div>
          <div className="wx-gauge" aria-label="gauge">
            <span className="on" /><span className="on" /><span className="on" /><span className="on" /><span className="on" />
            <span /><span /><span /><span /><span />
          </div>
          <div className="wx-explain">
            Погода считается из 5 факторов: <b>безопасный остаток</b>, <b>доля резерва под обязательства</b>, <b>волатильность дохода</b>, <b>дрейф категорий</b>, <b>прогресс накоплений</b>. Текущий балл — <b className="acc">5/10</b>, соответствует «Солнечно».
          </div>
        </div>

        <div className="wx-cells">
          <div className="k">классификация</div>
          <div className="mono" style={{ fontSize: 11, lineHeight: 1.9, color: "var(--muted)" }}>
            <div>☀︎ <b style={{ color: "var(--accent)" }}>Солнечно</b> · 0–3 · полный запас<br />&nbsp;&nbsp;&nbsp;и стабильность</div>
            <div>⛅ <b style={{ color: "var(--pos)" }}>Облачно</b> · 3–5 · всё норм,<br />&nbsp;&nbsp;&nbsp;мелкие сигналы</div>
            <div>🌧 <b style={{ color: "var(--warn)" }}>Дождь</b> · 5–7 · один из<br />&nbsp;&nbsp;&nbsp;факторов проседает</div>
            <div>⛈ <b style={{ color: "var(--neg)" }}>Шторм</b> · 7–10 · кризис</div>
          </div>
        </div>
      </div>
    </div>
  );
}
