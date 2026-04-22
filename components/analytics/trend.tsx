export function TrendCharts() {
  return (
    <div className="section fade-in" style={{ animationDelay: "180ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>тренд 12 месяцев</b> <span className="dim">· доход / расход / нетто</span>
        </div>
        <div className="meta mono">max ₽ 220k · min ₽ 108k</div>
      </div>
      <div className="section-body flush">
        <div className="trend">
          <div className="trend-cell">
            <div className="lbl">
              <span>Доход <b>vs</b> расход</span>
              <span className="mono" style={{ color: "var(--pos)" }}>нетто всегда плюс</span>
            </div>
            <svg viewBox="0 0 560 120" preserveAspectRatio="none">
              <g stroke="#1B2230" strokeWidth={1}>
                <line x1="0" y1="30" x2="560" y2="30" />
                <line x1="0" y1="60" x2="560" y2="60" />
                <line x1="0" y1="90" x2="560" y2="90" />
              </g>
              <polyline fill="rgba(63,185,80,.08)" stroke="none" points="0,70 50,66 100,60 150,58 200,62 250,50 300,44 350,40 400,36 450,32 500,28 560,22 560,120 0,120" />
              <polyline fill="none" stroke="#3FB950" strokeWidth={1.6} points="0,70 50,66 100,60 150,58 200,62 250,50 300,44 350,40 400,36 450,32 500,28 560,22" />
              <polyline fill="rgba(121,192,255,.06)" stroke="none" points="0,88 50,86 100,82 150,80 200,84 250,78 300,72 350,70 400,68 450,64 500,60 560,55 560,120 0,120" />
              <polyline fill="none" stroke="#79C0FF" strokeWidth={1.4} points="0,88 50,86 100,82 150,80 200,84 250,78 300,72 350,70 400,68 450,64 500,60 560,55" />
            </svg>
            <div className="foot">
              <span>май '25</span><span>авг '25</span><span>ноя '25</span><span>фев '26</span><span className="acc">апр '26</span>
            </div>
          </div>

          <div className="trend-cell">
            <div className="lbl">
              <span>Безопасно до <b>(дней)</b></span>
              <span className="mono" style={{ color: "var(--accent)" }}>47 дн сейчас</span>
            </div>
            <svg viewBox="0 0 360 120" preserveAspectRatio="none">
              <g stroke="#1B2230" strokeWidth={1}>
                <line x1="0" y1="40" x2="360" y2="40" />
                <line x1="0" y1="70" x2="360" y2="70" />
                <line x1="0" y1="100" x2="360" y2="100" />
              </g>
              <polyline fill="rgba(88,211,163,.1)" stroke="#58D3A3" strokeWidth={1.8} points="0,85 40,82 80,76 120,78 160,72 200,66 240,58 280,52 320,48 360,40" />
              <circle cx={360} cy={40} r={3} fill="#58D3A3" />
            </svg>
            <div className="foot"><span>12 нед назад</span><span>сейчас</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
