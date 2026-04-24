import type { ReactNode } from "react";

export type WeatherKind = "sun" | "cloud" | "rain" | "storm";

export interface WeatherProps {
  kind: WeatherKind;
  savingsRatePct: number | null;
  reason: string;
}

type KindConfig = {
  label: string;
  colorVar: string;
  score: number; // 1..10 — выше = хуже
  icon: ReactNode;
};

const KIND_CONFIG: Record<WeatherKind, KindConfig> = {
  sun: {
    label: "Солнечно",
    colorVar: "var(--accent)",
    score: 2,
    icon: (
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="50" cy="50" r="16" fill="rgba(88,211,163,.12)" stroke="currentColor" />
        <line x1="50" y1="20" x2="50" y2="26" />
        <line x1="50" y1="74" x2="50" y2="80" />
        <line x1="20" y1="50" x2="26" y2="50" />
        <line x1="74" y1="50" x2="80" y2="50" />
        <line x1="28" y1="28" x2="33" y2="33" />
        <line x1="67" y1="67" x2="72" y2="72" />
        <line x1="72" y1="28" x2="67" y2="33" />
        <line x1="33" y1="67" x2="28" y2="72" />
      </svg>
    ),
  },
  cloud: {
    label: "Облачно",
    colorVar: "var(--pos)",
    score: 4,
    icon: (
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 68 Q18 68 18 56 Q18 46 28 44 Q30 32 44 32 Q58 32 62 44 Q76 44 76 56 Q76 68 64 68 Z" fill="rgba(63,185,80,.10)" />
      </svg>
    ),
  },
  rain: {
    label: "Дождь",
    colorVar: "var(--warn)",
    score: 7,
    icon: (
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 56 Q18 56 18 44 Q18 34 28 32 Q30 20 44 20 Q58 20 62 32 Q76 32 76 44 Q76 56 64 56 Z" fill="rgba(210,153,34,.10)" />
        <line x1="34" y1="66" x2="30" y2="80" />
        <line x1="50" y1="66" x2="46" y2="80" />
        <line x1="66" y1="66" x2="62" y2="80" />
      </svg>
    ),
  },
  storm: {
    label: "Шторм",
    colorVar: "var(--neg)",
    score: 9,
    icon: (
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 56 Q18 56 18 44 Q18 34 28 32 Q30 20 44 20 Q58 20 62 32 Q76 32 76 44 Q76 56 64 56 Z" fill="rgba(248,81,73,.10)" />
        <path d="M50 60 L42 76 L54 74 L46 88" fill="none" />
      </svg>
    ),
  },
};

const REASON_HINT: Record<string, string> = {
  outflow_gt_inflow_3_months: "расход превышает доход три месяца подряд",
  savings_rate_lt_5pct: "норма накоплений ниже 5%",
  savings_rate_5_to_20pct: "норма накоплений 5–20%",
  savings_rate_gt_20pct: "норма накоплений выше 20%",
};

export function Weather({ kind, savingsRatePct, reason }: WeatherProps) {
  const cfg = KIND_CONFIG[kind];

  const srText =
    savingsRatePct === null
      ? "недостаточно данных за последний месяц"
      : `норма накоплений ${savingsRatePct >= 0 ? "+" : ""}${savingsRatePct.toFixed(1)}% за прошлый месяц`;

  const reasonText = REASON_HINT[reason] ?? "";

  return (
    <div className="section fade-in" style={{ animationDelay: "60ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>финансовая погода</b> <span className="dim">· здоровье финансов</span></div>
        <div className="meta mono">пересчёт раз в час · ведущий индикатор</div>
      </div>
      <div className="weather">
        <div className="wx-hero">
          <div className="wx-label">статус</div>
          <div className="wx-icon" aria-hidden style={{ color: cfg.colorVar }}>
            {cfg.icon}
          </div>
          <div className="wx-status" style={{ color: cfg.colorVar }}>{cfg.label}</div>
          <div className="wx-sub mono">{srText}</div>
        </div>

        <div className="wx-cells">
          <div className="k">шкала состояния</div>
          <div className="wx-gauge" aria-label="gauge">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className={i < cfg.score ? "on" : ""} />
            ))}
          </div>
          <div className="wx-explain">
            Погода считается из нормы накоплений и баланса доходов/расходов за последние 3 месяца.
            {reasonText ? <> Причина оценки: <b>{reasonText}</b>.</> : null}
            {" "}Текущая оценка — <b className="acc" style={{ color: cfg.colorVar }}>{cfg.score}/10</b>, соответствует «{cfg.label}».
          </div>
        </div>

        <div className="wx-cells">
          <div className="k">классификация</div>
          <div className="mono" style={{ fontSize: 11, lineHeight: 1.9, color: "var(--muted)" }}>
            <div>☀︎ <b style={{ color: "var(--accent)" }}>Солнечно</b> · норма &gt; 20%<br />&nbsp;&nbsp;&nbsp;полный запас</div>
            <div>⛅ <b style={{ color: "var(--pos)" }}>Облачно</b> · 5–20%<br />&nbsp;&nbsp;&nbsp;всё норм, мелкие сигналы</div>
            <div>🌧 <b style={{ color: "var(--warn)" }}>Дождь</b> · &lt; 5%<br />&nbsp;&nbsp;&nbsp;один из факторов проседает</div>
            <div>⛈ <b style={{ color: "var(--neg)" }}>Шторм</b> · расход &gt; доход 3 мес<br />&nbsp;&nbsp;&nbsp;кризис</div>
          </div>
        </div>
      </div>
    </div>
  );
}
