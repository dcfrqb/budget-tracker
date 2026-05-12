import { getT, getLocale } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/format/money";
import { pluralRu, pluralEn } from "@/lib/i18n/plural";
import { Prisma } from "@prisma/client";
import type { OrderStatusBreakdownRow } from "@/lib/data/work-sources";
import { STATUS_COLOR, STATUS_ORDER } from "./order-status-colors";

interface Props {
  rows: OrderStatusBreakdownRow[];
  sourceCcy: string;
}

export async function OrderStatusBreakdown({ rows, sourceCcy }: Props) {
  const locale = await getLocale();
  const t = await getT(locale);
  const orderWord = (n: number) =>
    locale === "ru"
      ? pluralRu(n, ["заказ", "заказа", "заказов"])
      : pluralEn(n, "order", "orders");

  const grandTotal = rows.reduce((s, r) => s.plus(r.total), new Prisma.Decimal(0));
  const grandCount = rows.reduce((s, r) => s + r.count, 0);
  const hasOrders = grandCount > 0;

  // Proportions by amount; fall back to count when total is zero
  function pct(row: OrderStatusBreakdownRow): number {
    if (!grandTotal.isZero()) {
      return row.total.div(grandTotal).times(100).toNumber();
    }
    if (grandCount > 0) {
      return (row.count / grandCount) * 100;
    }
    return 0;
  }

  const statusLabelKey = (status: string) =>
    `income.work.detail.orders.status.${status.toLowerCase()}` as Parameters<typeof t>[0];

  return (
    <div className="section" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("income.work.detail.status_breakdown.title")}</b>
        </div>
      </div>
      <div className="section-body" style={{ padding: "var(--sp-3)" }}>
        {!hasOrders ? (
          <div
            className="mono"
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--muted)",
              textAlign: "center",
              padding: "var(--sp-4) 0",
            }}
          >
            {t("income.work.detail.status_breakdown.empty")}
          </div>
        ) : (
          <>
            <div className="ws-status-bar" style={{ marginBottom: "var(--sp-3)" }}>
              {STATUS_ORDER.map((status) => {
                const row = rows.find((r) => r.status === status);
                const p = row ? pct(row) : 0;
                if (p === 0) return null;
                return (
                  <div
                    key={status}
                    className="ws-status-segment"
                    style={{
                      width: `${p}%`,
                      background: STATUS_COLOR[status],
                    }}
                  />
                );
              })}
            </div>
            <div className="ws-status-legend">
              {STATUS_ORDER.map((status) => {
                const row = rows.find((r) => r.status === status) ?? {
                  status,
                  count: 0,
                  total: new Prisma.Decimal(0),
                };
                return (
                  <div key={status} className="ws-status-legend-row">
                    <div
                      className="ws-status-dot"
                      style={{ background: STATUS_COLOR[status] }}
                    />
                    <span style={{ color: "var(--text)", flex: 1 }}>
                      {t(statusLabelKey(status))}
                    </span>
                    <span className="mono" style={{ color: "var(--muted)" }}>
                      {row.count}&nbsp;{orderWord(row.count)}
                    </span>
                    <span
                      className="mono"
                      style={{ color: "var(--text)", marginLeft: "var(--sp-3)" }}
                    >
                      {formatMoney(row.total, sourceCcy)}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
