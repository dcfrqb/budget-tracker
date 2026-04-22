// TODO: CSV import — separate slice. Пока визуальная заглушка.
export function ImportBar() {
  return (
    <div className="section fade-in" style={{ animationDelay: "300ms" }}>
      <div className="import-bar">
        <div className="l">
          <div className="icn">
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h11v3H2z" />
              <path d="M2 9h11v3H2z" />
              <path d="M4.5 4.5h.01M4.5 10.5h.01" />
            </svg>
          </div>
          <div>
            <div className="t">Импорт из банковского CSV</div>
            <div className="s">Тинькофф · Сбер · Альфа · Т-Банк · авто-категория</div>
          </div>
        </div>
        <div className="r">
          <button type="button" className="btn">Тинькофф .csv</button>
          <button type="button" className="btn">Сбер .csv</button>
          <button type="button" className="btn primary">Загрузить файл</button>
        </div>
      </div>
    </div>
  );
}
