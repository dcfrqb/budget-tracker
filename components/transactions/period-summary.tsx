"use client";

import { CountUp } from "@/components/count-up";
import { useT } from "@/lib/i18n";
import type { PeriodSummaryView } from "@/lib/view/transactions";

type Props = { summary: PeriodSummaryView };

export function PeriodSummary({ summary }: Props) {
  const t = useT();
  const { inflow, outflow, transfers, net, totalCount, plannedCount, partialCount } = summary;

  const netSign = net.tone === "pos" ? "+" : net.tone === "neg" ? "−" : "";
  const netValClass =
    net.tone === "pos" ? "val net-pos" : net.tone === "neg" ? "val net-neg" : "val net";
  const netNote =
    net.tone === "pos"
      ? t("transactions.period.net_forecast", { vars: { amount: net.noteAmount } })
      : net.tone === "neg"
      ? t("transactions.period.net_deficit", { vars: { amount: net.noteAmount } })
      : t("transactions.period.net_zero");

  const metaParts: string[] = [`${totalCount} ${t("transactions.period.txn_short")}`];
  if (plannedCount > 0) metaParts.push(t("transactions.period.planned_count", { vars: { n: String(plannedCount) } }));
  if (partialCount > 0) metaParts.push(t("transactions.period.partial_count", { vars: { n: String(partialCount) } }));
  const metaLine = metaParts.join(" · ");

  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("transactions.period.title")}</b>{" "}
          <span className="dim">{t("transactions.period.range")}</span>
        </div>
        <div className="meta mono">{metaLine}</div>
      </div>
      <div className="section-body flush">
        <div className="period-grid">
          <div className="period-cell">
            <div className="code inflow">{t("transactions.period.column.inflow")}</div>
            <div className="val inflow">
              +₽ <CountUp to={inflow.value} />
            </div>
            <div className="meta">
              {inflow.count} {t("transactions.period.txn_short")} ·{" "}
              {t("transactions.period.avg")} {inflow.avgAmount}
            </div>
          </div>
          <div className="period-cell">
            <div className="code outflow">{t("transactions.period.column.outflow")}</div>
            <div className="val outflow">
              −₽ <CountUp to={outflow.value} />
            </div>
            <div className="meta">
              {outflow.count} {t("transactions.period.txn_short")} ·{" "}
              {t("transactions.period.avg")} {outflow.avgAmount}
            </div>
          </div>
          <div className="period-cell">
            <div className="code xfr">{t("transactions.period.column.xfr")}</div>
            <div className="val xfr">
              ₽ <CountUp to={transfers.value} />
            </div>
            <div className="meta">
              {transfers.count} {t("transactions.period.txn_short")}
            </div>
          </div>
          <div className="period-cell">
            <div className="code net">{t("transactions.period.column.net")}</div>
            <div className={netValClass}>
              {netSign}₽ <CountUp to={Math.abs(net.value)} />
            </div>
            <div className="meta">{netNote}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
