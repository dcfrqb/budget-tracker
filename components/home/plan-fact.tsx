import { CountUp } from "@/components/count-up";
import type { HomePlanFactCell } from "@/lib/view/home";

const BAR_COLOR = {
  pos:  "var(--pos)",
  info: "var(--info)",
  acc:  "var(--accent)",
} as const;

const RU_MONTHS_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

function currentMonthLabel() {
  const now = new Date();
  return `${RU_MONTHS_SHORT[now.getMonth()]} ${now.getFullYear()}`;
}

export function PlanFact({ cells }: { cells: HomePlanFactCell[] }) {
  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>план-факт</b> <span className="dim">· {currentMonthLabel()}</span>
        </div>
        <div className="meta mono">текущий месяц</div>
      </div>
      <div className="section-body flush">
        <div className="pf-grid">
          {cells.map((cell, i) => {
            const pct = cell.plan > 0 ? Math.min(100, Math.round((cell.fact / cell.plan) * 100)) : 0;
            const barWidth = cell.kind === "net" ? 100 : pct;
            const barDelay = 260 + i * 80;
            return (
              <div className="pf-cell" key={cell.code}>
                <div className={`code ${cell.kind} mono`}>{cell.code}</div>
                <div className={`val ${cell.color} mono`}>
                  {cell.currency}{" "}
                  <CountUp to={cell.fact} />
                </div>
                <div className="of mono">{cell.sub}</div>
                <div className="pf-bar">
                  <div
                    className="fill"
                    style={{
                      width: `${barWidth}%`,
                      background: BAR_COLOR[cell.color],
                      ["--bar-delay" as string]: `${barDelay}ms`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
