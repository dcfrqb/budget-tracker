import { getT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/format/money";
import { Prisma } from "@prisma/client";
import type { WorkSourceFreelanceOrder } from "@/lib/data/work-sources";

interface Props {
  orders: WorkSourceFreelanceOrder[];
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "var(--accent)",
  AWAITING_PAYMENT: "var(--warn)",
  COMPLETED: "var(--pos)",
  CANCELLED: "var(--muted)",
};

export async function FreelanceOrdersPanel({ orders }: Props) {
  const t = await getT();

  return (
    <div className="section" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("income.work.detail.orders.title")}</b>
          <span className="dim"> · {orders.length}</span>
        </div>
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

            return (
              <div
                key={order.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  padding: "10px var(--sp-3)",
                  borderBottom: "1px solid var(--border)",
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
            );
          })
        )}
      </div>
    </div>
  );
}
