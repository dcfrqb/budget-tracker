export function WorkSourcesSection() {
  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>источники дохода</b> <span className="dim">· работа + фриланс</span>
        </div>
        <div className="meta mono">
          <button type="button" className="btn primary" style={{ padding: "3px 9px", fontSize: 10 }}>
            + Добавить источник
          </button>
        </div>
      </div>
      <div className="section-body flush">
        <div className="ws-grid">
          <article className="ws-card" tabIndex={0}>
            <div className="ws-top">
              <span className="ws-tag emp">Работа</span>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>с 2023-09-01</span>
            </div>
            <div className="ws-title">
              Acme Robotics ООО
              <div className="sub">Старший продукт-дизайнер · зп 10-го</div>
            </div>
            <div className="ws-meta">
              <div><div className="k">Чистая зп</div><div className="v pos">₽ 120 000 /мес</div></div>
              <div><div className="k">Налог</div><div className="v">НДФЛ 13%</div></div>
              <div><div className="k">Премии</div><div className="v">квартально · плав.</div></div>
              <div><div className="k">Отпуск / больн.</div><div className="v">28д / опл.</div></div>
            </div>
            <div className="ws-footer">
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                след: <b style={{ color: "var(--text)" }}>10 мая · ₽ 120 000</b>
              </span>
              <span className="ws-amt pos">₽ 120 000</span>
            </div>
          </article>

          <article className="ws-card" tabIndex={0}>
            <div className="ws-top">
              <span className="ws-tag fl">Фриланс</span>
              <span className="mono" style={{ fontSize: 10, color: "var(--warn)" }}>активно · этап 2/3</span>
            </div>
            <div className="ws-title">
              Hatch · редизайн онбординга
              <div className="sub">проект-контракт · счета EUR</div>
            </div>
            <div className="ws-meta">
              <div><div className="k">Сумма</div><div className="v">€ 3 600</div></div>
              <div><div className="k">Налог</div><div className="v">Самозан. 6%</div></div>
              <div><div className="k">В час ≈</div><div className="v">€ 60 / h</div></div>
              <div><div className="k">Сдать до</div><div className="v">31 мая 2026</div></div>
            </div>
            <div className="stages">
              <div className="stage done"><div className="n">Старт</div><div className="a">€ 1200</div></div>
              <div className="stage active"><div className="n">Сред · частично</div><div className="a">€ 1200</div></div>
              <div className="stage pending"><div className="n">Финал</div><div className="a">€ 1200</div></div>
            </div>
            <div className="ws-footer">
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                ожидает: <b style={{ color: "var(--warn)" }}>€ 1 200</b> · сред. этап
              </span>
              <span className="ws-amt acc">€ 1 200</span>
            </div>
          </article>

          <article className="ws-card" tabIndex={0}>
            <div className="ws-top">
              <span className="ws-tag fl">Фриланс</span>
              <span className="mono" style={{ fontSize: 10, color: "var(--pos)" }}>завершено · оплачено</span>
            </div>
            <div className="ws-title">
              Acme Design Sprint
              <div className="sub">фикс · один счёт</div>
            </div>
            <div className="ws-meta">
              <div><div className="k">Сумма</div><div className="v">₽ 45 000</div></div>
              <div><div className="k">Подск. налог</div><div className="v acc">₽ 2 700 · 6%</div></div>
              <div><div className="k">Оплачено</div><div className="v">18 апр 2026</div></div>
              <div><div className="k">Статус</div><div className="v pos">Выполнено</div></div>
            </div>
            <div className="ws-footer">
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                получено · налог не проводится авто
              </span>
              <span className="ws-amt pos">₽ 45 000</span>
            </div>
          </article>

          <article className="ws-card add" tabIndex={0}>
            <div>
              <div className="plus">+</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--text)" }}>новый источник</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--dim)", marginTop: 4 }}>
                работа · фриланс · разовый
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "center" }}>
                <button type="button" className="btn" style={{ fontSize: 10, padding: "4px 10px" }}>Работа</button>
                <button type="button" className="btn" style={{ fontSize: 10, padding: "4px 10px" }}>Фриланс</button>
              </div>
            </div>
          </article>
        </div>
      </div>
      <div className="tax-hint">
        <div className="l">
          <div className="t">Подск. налог · self-employed 6% on April freelance income</div>
          <div className="s">посч. с ₽ 188 400 · не транзакция · плати когда сдашь</div>
        </div>
        <div className="v">₽ 11 304 <span className="u">≈ 6%</span></div>
        <button type="button" className="btn primary">Создать напоминание</button>
      </div>
    </div>
  );
}
