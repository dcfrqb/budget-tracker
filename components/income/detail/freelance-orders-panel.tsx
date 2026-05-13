import { getT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/format/money";
import { Prisma } from "@prisma/client";
import type { WorkSourceFreelanceOrder } from "@/lib/data/work-sources";
import { FreelanceOrdersPanelAdd } from "./freelance-orders-panel-add";
import type { CurrencyOption } from "@/components/forms/currency-select";
import { STATUS_COLOR } from "./order-status-colors";
import { FreelanceOrderPayments } from "./freelance-order-payments";

interface Props {
  orders: WorkSourceFreelanceOrder[];
  workSourceId?: string;
  workSourceCurrency?: string;
  currencies?: CurrencyOption[];
  userId?: string;
}

export async function FreelanceOrdersPanel({ orders, workSourceId, workSourceCurrency, currencies, userId }: Props) {
  const t = await getT();

  const canAdd = !!(workSourceId && workSourceCurrency && currencies);

  return (
    <div className="section" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("income.work.detail.orders.title")}</b>
          <span className="dim"> · {orders.length}</span>
        </div>
        {canAdd && (
          <FreelanceOrdersPanelAdd
            workSourceId={workSourceId!}
            workSourceCurrency={workSourceCurrency!}
            currencies={currencies!}
          />
        )}
      </div>
      <div className="section-body flush">
        {orders.length === 0 ? (
          <div
            className="mono"
            style={{
              padding: "var(--sp-4) var(--sp-3)",
              fontSize: "var(--text-sm)",
              color: "var(--muted)",
              textAlign: "center",
            }}
          >
            {t("income.work.detail.orders.empty")}
          </div>
        ) : (
          orders.map((order) => {
            const statusColor = STATUS_COLOR[order.status] ?? "var(--muted)";
            const amount = new Prisma.Decimal(order.amount);
            const tips = order.tipsAmount ? new Prisma.Decimal(order.tipsAmount) : null;
            const showPaidLine = order.paidCount > 0 || !order.paidSum.isZero();

            return (
              <div
                key={order.id}
                style={{
                  padding: "10px var(--sp-3)",
                  borderBottom: "1px solid var(--border)",
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
                    <div
                      style={{ fontSize: "var(--text-sm)", color: "var(--text)", fontWeight: 600 }}
                    >
                      {order.client ?? "—"}
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}
                    >
                      {order.performedAt
                        ? order.performedAt.toISOString().slice(0, 10)
                        : "—"}
                      {order.hours && ` · ${order.hours}h`}
                      {order.paidAt && ` · ${t("income.work.detail.orders.paid_prefix")} ${order.paidAt.toISOString().slice(0, 10)}`}
                    </div>
                    {showPaidLine && (
                      <div
                        className="mono"
                        style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginTop: "var(--sp-1)" }}
                      >
                        {t("income.work.detail.orders.paid_sum_line", {
                          vars: {
                            paid: formatMoney(order.paidSum, order.currencyCode),
                            total: formatMoney(amount, order.currencyCode),
                            count: String(order.paidCount),
                          },
                        })}
                      </div>
                    )}
                    {order.paidCountOtherCcy > 0 && (
                      <div
                        className="mono"
                        style={{ fontSize: "var(--text-xs)", color: "var(--warn, var(--accent))" }}
                      >
                        {t("income.work.detail.orders.different_ccy_excluded", {
                          vars: { count: String(order.paidCountOtherCcy) },
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                    <div
                      className="mono"
                      style={{ fontWeight: 700, color: "var(--pos)", fontSize: "var(--text-sm)" }}
                    >
                      {formatMoney(amount, order.currencyCode)}
                    </div>
                    {tips && tips.gt(0) && (
                      <div className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--accent)" }}>
                        +{formatMoney(tips, order.currencyCode)} {t("income.work.detail.orders.tips_suffix")}
                      </div>
                    )}
                    <div
                      className="mono"
                      style={{ fontSize: "var(--text-xs)", color: statusColor }}
                    >
                      {t(`income.work.detail.orders.status.${order.status.toLowerCase()}` as Parameters<typeof t>[0])}
                    </div>
                  </div>
                </div>
                {order.paidCount > 0 && userId && (
                  <details style={{ marginTop: "var(--sp-2)" }}>
                    <summary
                      className="mono"
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--muted)",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      {t("income.work.detail.orders.payments_toggle")} · {order.paidCount}
                    </summary>
                    <div style={{ marginTop: "var(--sp-2)" }}>
                      <FreelanceOrderPayments orderId={order.id} userId={userId} />
                    </div>
                  </details>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
