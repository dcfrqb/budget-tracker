export function AddAccountCta() {
  return (
    <div className="section fade-in" style={{ animationDelay: "380ms" }}>
      <div className="add-cta">
        <div className="l">
          <div className="ico mono">+</div>
          <div>
            <div className="t">Добавить новый счёт</div>
            <div className="s">банк · крипто · наличка · ручной ввод</div>
          </div>
        </div>
        <div className="r">
          <button type="button" className="btn">Банк</button>
          <button type="button" className="btn">Крипто</button>
          <button type="button" className="btn">Наличка</button>
          <button type="button" className="btn primary">Ручной ввод</button>
        </div>
      </div>
    </div>
  );
}
