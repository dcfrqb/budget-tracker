"use client";

import { useState } from "react";
import { Prisma, FreelanceOrderStageStatus } from "@prisma/client";
import { useT } from "@/lib/i18n";
import { formatMoney } from "@/lib/format/money";
import { STATUS_COLOR } from "./order-status-colors";
import { FreelanceOrderQuickEdit } from "./freelance-order-quick-edit";
import type { WorkSourceFreelanceOrder } from "@/lib/data/work-sources";
import type { CurrencyOption } from "@/components/forms/currency-select";
import type { AccountOption } from "./freelance-order-stages";

interface Props {
  orders: WorkSourceFreelanceOrder[];
  workSourceId: string;
  workSourceCurrency: string;
  currencies: CurrencyOption[];
  accounts: AccountOption[];
}

export function FreelanceOrdersPanelRows({
  orders,
  workSourceId,
  workSourceCurrency,
  currencies,
  accounts,
}: Props) {
  const t = useT();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <>
      {orders.map((order) => {
        const statusColor = STATUS_COLOR[order.status] ?? "var(--muted)";
        const amount = new Prisma.Decimal(order.amount);
        const tips = order.tipsAmount ? new Prisma.Decimal(order.tipsAmount) : null;

        // Compute received
        const hasStages = order.stages.length > 0;
        let received: Prisma.Decimal;
        if (hasStages) {
          received = order.stages
            .filter((s) => s.status === FreelanceOrderStageStatus.PAID && s.paidAmount != null)
            .reduce((sum, s) => sum.plus(new Prisma.Decimal(s.paidAmount!)), new Prisma.Decimal(0));
        } else {
          received = order.paidSum;
        }
        const remaining = amount.minus(received).lt(0) ? new Prisma.Decimal(0) : amount.minus(received);
        const pct = amount.gt(0) ? received.div(amount).mul(100).toNumber() : 0;
        const clampedPct = Math.min(100, Math.max(0, pct));

        // Derive title
        const orderTitle = (order as unknown as { title?: string }).title ?? order.client ?? "—";
        const isExpanded = expandedId === order.id;

        return (
          <div key={order.id}>
            {/* Row header — clickable to toggle quick-edit */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setExpandedId(isExpanded ? null : order.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpandedId(isExpanded ? null : order.id);
                }
              }}
              style={{
                padding: "10px var(--sp-3)",
                borderBottom: isExpanded ? "none" : "1px solid var(--border)",
                cursor: "pointer",
                background: isExpanded ? "var(--panel-3)" : undefined,
                transition: "background 150ms ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "var(--sp-2)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--text)", fontWeight: 600 }}>
                    {orderTitle}
                  </div>
                  {order.client && orderTitle !== order.client && (
                    <div className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--dim)" }}>
                      {order.client}
                    </div>
                  )}
                  <div className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>
                    {order.performedAt
                      ? order.performedAt.toISOString().slice(0, 10)
                      : "—"}
                    {order.hours && ` · ${order.hours}h`}
                  </div>
                  {/* Plan/fact line */}
                  {(!received.isZero() || hasStages) && (
                    <div className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginTop: 2 }}>
                      {t("income.work.detail.orders.plan_fact", {
                        vars: {
                          received: formatMoney(received, order.currencyCode),
                          plan: formatMoney(amount, order.currencyCode),
                          remaining: formatMoney(remaining, order.currencyCode),
                        },
                      })}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                  <div className="mono" style={{ fontWeight: 700, color: "var(--pos)", fontSize: "var(--text-sm)" }}>
                    {formatMoney(amount, order.currencyCode)}
                  </div>
                  {tips && tips.gt(0) && (
                    <div className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--accent)" }}>
                      +{formatMoney(tips, order.currencyCode)} {t("income.work.detail.orders.tips_suffix")}
                    </div>
                  )}
                  <div className="mono" style={{ fontSize: "var(--text-xs)", color: statusColor }}>
                    {t(`income.work.detail.orders.status.${order.status.toLowerCase()}` as Parameters<typeof t>[0])}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--dim)" }}>
                    {isExpanded ? "▲" : "▼"}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              {(!received.isZero() || hasStages) && (
                <div className="src-cmp-bar-track" style={{ marginTop: 6 }}>
                  <div
                    className="src-cmp-bar-fill"
                    style={{
                      width: `${clampedPct}%`,
                      background: received.gte(amount) ? "var(--pos)" : "var(--accent)",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Quick edit — expanded section */}
            {isExpanded && (
              <FreelanceOrderQuickEdit
                order={order}
                workSourceId={workSourceId}
                workSourceCurrency={workSourceCurrency}
                currencies={currencies}
                accounts={accounts}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
