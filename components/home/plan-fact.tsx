import { getT } from "@/lib/i18n/server";
import { CountUp } from "@/components/count-up";
import type { HomePlanFactCell } from "@/lib/view/home";
import type { TKey } from "@/lib/i18n/t";
const BAR_COLOR = {
  pos:  "var(--pos)",
  neg:  "var(--neg)",
  info: "var(--info)",
  acc:  "var(--accent)",
} as const;

const MONTH_KEYS: TKey[] = [
  "common.month.short.1",
  "common.month.short.2",
  "common.month.short.3",
  "common.month.short.4",
  "common.month.short.5",
  "common.month.short.6",
  "common.month.short.7",
  "common.month.short.8",
  "common.month.short.9",
  "common.month.short.10",
  "common.month.short.11",
  "common.month.short.12",
];

export async function PlanFact({
  cells,
}: {
  cells: HomePlanFactCell[];
}) {
  const t = await getT();
  const now = new Date();
  const dimLabel = `${t(MONTH_KEYS[now.getMonth()])} ${now.getFullYear()}`;
  const metaKey: TKey = "home.plan_fact.meta";
  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("home.plan_fact.title")}</b>{" "}
          <span className="dim">· {dimLabel}</span>
        </div>
        <div className="meta mono">{t(metaKey)}</div>
      </div>
      <div className="section-body flush">
        <div className="pf-grid">
          {cells.map((cell, i) => {
            const barDelay = 260 + i * 80;

            if (cell.mode === "no_plan_set") {
              return (
                <div className="pf-cell" key={cell.code}>
                  <div className={`code ${cell.kind} mono`}>{cell.code}</div>
                  <div className="val mono money" style={{ color: "var(--muted)" }}>—</div>
                  <div className="of mono" style={{ color: "var(--muted)" }}>
                    {t("home.plan_fact.no_plan_set")}
                  </div>
                  <div className="pf-bar" />
                </div>
              );
            }

            if (cell.mode === "actual_without_plan") {
              return (
                <div className="pf-cell" key={cell.code}>
                  <div className={`code ${cell.kind} mono`}>{cell.code}</div>
                  <div className="val mono money" style={{ color: BAR_COLOR[cell.color] }}>
                    {cell.sign}<CountUp to={cell.fact} /> ₽
                  </div>
                  <div className="of mono" style={{ color: "var(--muted)" }}>
                    {t("home.plan_fact.actual_without_plan")}
                  </div>
                  <div className="pf-bar">
                    <div
                      className="fill"
                      style={{
                        width: "100%",
                        background: BAR_COLOR[cell.color],
                        opacity: 0.4,
                        ["--bar-delay" as string]: `${barDelay}ms`,
                      }}
                    />
                  </div>
                </div>
              );
            }

            const pct = cell.plan > 0
              ? Math.min(100, Math.round((cell.fact / cell.plan) * 100))
              : 0;
            const barWidth = cell.kind === "net" ? 100 : pct;
            return (
              <div className="pf-cell" key={cell.code}>
                <div className={`code ${cell.kind} mono`}>{cell.code}</div>
                <div className="val mono money" style={{ color: BAR_COLOR[cell.color] }}>
                  {cell.sign}<CountUp to={cell.fact} /> ₽
                </div>
                <div className="of mono">
                  {cell.sub || t("home.plan_fact.no_plan")}
                </div>
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
