import { CountUp } from "@/components/count-up";
import { MONTH_LABEL, PLAN_FACT } from "@/lib/mock";

const BAR_COLOR = {
  pos:  "var(--pos)",
  info: "var(--info)",
  acc:  "var(--accent)",
} as const;

export function PlanFact() {
  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>план-факт</b> <span className="dim">· {MONTH_LABEL}</span>
        </div>
        <div className="meta mono">на 21.04 12:40</div>
      </div>
      <div className="section-body flush">
        <div className="pf-grid">
          {PLAN_FACT.map((cell, i) => {
            const pct = Math.min(100, Math.round((cell.fact / cell.plan) * 100));
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
