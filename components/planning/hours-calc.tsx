export function HoursCalculator() {
  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>калькулятор часов</b> <span className="dim">· сколько работы стоит покупка</span>
        </div>
        <div className="meta mono">источник: Acme · ₽ 1 180 / ч (чистая)</div>
      </div>
      <div className="hcalc">
        <div className="block">
          <div className="lbl">цена покупки</div>
          <div className="val">₽ 120 000</div>
          <div className="sub">введи сумму и валюту</div>
        </div>
        <div className="sep">÷</div>
        <div className="block">
          <div className="lbl">ставка / час (чистая)</div>
          <div className="val">₽ 1 180<span className="u">/ ч</span></div>
          <div className="sub">Acme · 160 ч/мес · после НДФЛ 13%</div>
        </div>
        <div className="sep">=</div>
        <div className="block">
          <div className="lbl">чистые часы работы</div>
          <div className="val warn">101<span className="u">ч</span></div>
          <div className="sub">≈ 2.5 недели при твоём графике · брутто 88ч до налога</div>
        </div>
      </div>
    </div>
  );
}
