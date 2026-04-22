/* Amortization mini-chart: interest (top) decreases, principal (bottom) grows.
   18 columns = next 18 monthly payments. First column is current month. */
function AmortChart() {
  const cols = Array.from({ length: 18 }, (_, i) => {
    const interest = 34 - i * 0.5;           // visual % shrink
    const principal = 66 + i * 0.5;
    return { i, interest, principal };
  });
  return (
    <div className="amort">
      {cols.map((c) => (
        <div key={c.i} className={`amort-col${c.i === 0 ? " current" : " future"}`}>
          <div className="interest" style={{ height: c.interest * 0.55 }} />
          <div className="principal" style={{ height: c.principal * 0.42 }} />
        </div>
      ))}
    </div>
  );
}

export function Loans() {
  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>кредиты / ипотека</b></div>
        <div className="meta mono">
          <button type="button" className="btn primary" style={{ padding: "3px 9px", fontSize: 10 }}>
            + Добавить кредит
          </button>
        </div>
      </div>

      <article className="loan-card">
        <header className="loan-hd">
          <div>
            <div className="loan-tag">
              <span className="code">КРЕДИТ · ИПОТЕКА</span>
              <span className="loan-name">Ипотека · Сбербанк</span>
            </div>
            <div className="loan-sub">2-комн · Москва · 15 лет · с 2023-06-10</div>
          </div>
          <div className="loan-due"><b>28 апр · 7д</b>₽ 57 400 · авто</div>
        </header>
        <div className="loan-body">
          <div className="loan-cell">
            <div className="loan-stats">
              <div><div className="k">Остаток тела</div><div className="v neg">₽ 3 847 500</div></div>
              <div><div className="k">Ставка</div><div className="v">11.9% / yr</div></div>
              <div><div className="k">Платёж / мес</div><div className="v">₽ 57 400</div></div>
              <div><div className="k">Осталось</div><div className="v">134 mo</div></div>
              <div><div className="k">Выпл. всего</div><div className="v acc">₽ 1 952 500</div></div>
              <div><div className="k">Переплата</div><div className="v neg">₽ 1 237 860</div></div>
            </div>
            <div className="loan-prog-wrap">
              <div className="loan-prog-lbl"><span>прогресс · 34%</span><span>46 / 180 платежей</span></div>
              <div className="loan-prog">
                <span className="paid" style={{ width: "34%" }} />
                <span className="rem"  style={{ width: "66%" }} />
              </div>
            </div>
          </div>
          <div className="loan-cell">
            <div className="mono" style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
              амортизация · ближ. 18 мес
            </div>
            <AmortChart />
            <div className="amort-legend">
              <span><span className="sw" style={{ background: "var(--loan)" }} />проценты</span>
              <span><span className="sw" style={{ background: "var(--accent)" }} />тело</span>
              <span style={{ marginLeft: "auto" }}>
                <span className="sw" style={{ outline: "1px solid var(--warn)", background: "var(--panel)" }} />тек. мес
              </span>
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 10, display: "flex", justifyContent: "space-between" }}>
              <span>разбивка за мес</span>
              <span>тело <span style={{ color: "var(--accent)" }}>₽ 38 140</span> · проценты <span style={{ color: "var(--loan)" }}>₽ 19 260</span></span>
            </div>
          </div>
        </div>
      </article>

      <article className="loan-card">
        <header className="loan-hd">
          <div>
            <div className="loan-tag">
              <span className="code">КРЕДИТ · ПОТРЕБ.</span>
              <span className="loan-name">Потреб. · Альфа · ноутбук</span>
            </div>
            <div className="loan-sub">24 мес · с 2025-09-12 · 8 выпл.</div>
          </div>
          <div className="loan-due"><b>12 мая · 21д</b>₽ 8 540 · авто</div>
        </header>
        <div className="loan-body">
          <div className="loan-cell">
            <div className="loan-stats">
              <div><div className="k">Остаток</div><div className="v neg">₽ 138 400</div></div>
              <div><div className="k">Ставка</div><div className="v">14.5% / yr</div></div>
              <div><div className="k">Мес</div><div className="v">₽ 8 540</div></div>
              <div><div className="k">Осталось</div><div className="v">16 mo</div></div>
            </div>
            <div className="loan-prog-wrap">
              <div className="loan-prog-lbl"><span>33%</span><span>8 / 24</span></div>
              <div className="loan-prog">
                <span className="paid" style={{ width: "33%" }} />
                <span className="rem"  style={{ width: "67%" }} />
              </div>
            </div>
          </div>
          <div className="loan-cell overpay">
            <div className="row"><span className="k">Выпл. всего</span><span className="v" style={{ color: "var(--accent)" }}>₽ 68 320</span></div>
            <div className="row"><span className="k">Погаш. тело</span><span className="v" style={{ color: "var(--accent)" }}>₽ 51 600</span></div>
            <div className="row"><span className="k">Выпл. проценты</span><span className="v" style={{ color: "var(--loan)" }}>₽ 16 720</span></div>
            <div className="row"><span className="k">Всего %% до конца</span><span className="v warn">₽ 33 440</span></div>
          </div>
        </div>
      </article>
    </div>
  );
}
