import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUserId } from "@/lib/api/auth";
import { getT, getLocale } from "@/lib/i18n/server";
import { getFreelanceOrderDetail } from "@/lib/data/freelance-orders";
import { listAccountsForQuickDrawer } from "@/lib/data/wallet";
import { listAllCurrencies } from "@/lib/data/currencies";
import { FreelanceOrderStages } from "@/components/income/detail/freelance-order-stages";
import { FreelanceOrderPayments } from "@/components/income/detail/freelance-order-payments";
import { formatMoney } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";
import { Prisma } from "@prisma/client";
import { OrderDetailActions } from "./order-detail-actions";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; orderId: string }>;
}

export default async function OrderDetailPage({ params }: Props) {
  const { id: workSourceId, orderId } = await params;
  const [userId, t, locale] = await Promise.all([
    getCurrentUserId(),
    getT(),
    getLocale(),
  ]);

  const [detail, accounts, currencies] = await Promise.all([
    getFreelanceOrderDetail(userId, orderId),
    listAccountsForQuickDrawer(userId),
    listAllCurrencies(),
  ]);

  if (!detail || detail.order.workSourceId !== workSourceId) notFound();

  const { order, linkedTxns } = detail;
  const amount = new Prisma.Decimal(order.amount);
  const currencyOptions = currencies.map((c) => ({ code: c.code, symbol: c.symbol }));

  const orderTitle = order.title;
  const orderDesc = order.description;

  return (
    <div className="page-content">
      {/* Back link */}
      <div style={{ padding: "var(--sp-3) var(--sp-3) 0" }}>
        <Link
          href={`/income/work-sources/${workSourceId}`}
          className="mono"
          style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}
        >
          ← {t("income.order_detail.back")}
        </Link>
      </div>

      {/* Heading */}
      <div
        className="section"
        style={{ padding: "var(--sp-3)", borderBottom: "1px solid var(--border)" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--sp-2)" }}>
          <div>
            <div
              style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--text)" }}
            >
              {orderTitle}
            </div>
            {order.client && orderTitle !== order.client && (
              <div className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--muted)", marginTop: 2 }}>
                {order.client}
              </div>
            )}
            {orderDesc && (
              <div
                style={{ fontSize: "var(--text-sm)", color: "var(--muted)", marginTop: "var(--sp-2)" }}
              >
                {orderDesc}
              </div>
            )}
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div className="mono" style={{ fontWeight: 700, color: "var(--pos)", fontSize: "var(--text-lg)" }}>
              {formatMoney(amount, order.currencyCode)}
            </div>
            {order.tipsAmount && new Prisma.Decimal(order.tipsAmount).gt(0) && (
              <div className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--accent)", marginTop: 2 }}>
                +{formatMoney(new Prisma.Decimal(order.tipsAmount), order.currencyCode)} {t("income.work.detail.orders.tips_suffix")}
              </div>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div
          className="mono"
          style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginTop: "var(--sp-2)", display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}
        >
          {order.performedAt && (
            <span>{t("income.order_detail.dates")}: {formatDate(order.performedAt, locale)}</span>
          )}
          {order.hours && (
            <span>{t("income.order_detail.hours_rate")}: {String(order.hours)}h</span>
          )}
          {order.hourlyRate && (
            <span>@ {formatMoney(new Prisma.Decimal(order.hourlyRate), order.currencyCode)}/h</span>
          )}
        </div>

        {order.note && (
          <div style={{ fontSize: "var(--text-sm)", color: "var(--muted)", marginTop: "var(--sp-2)", borderTop: "1px solid var(--border)", paddingTop: "var(--sp-2)" }}>
            {order.note}
          </div>
        )}
      </div>

      {/* Stages */}
      <div className="section" style={{ padding: "var(--sp-3)", borderBottom: "1px solid var(--border)" }}>
        <div
          className="mono"
          style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginBottom: "var(--sp-2)", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}
        >
          {t("income.work.detail.orders.stages_title")}
        </div>
        <FreelanceOrderStages
          freelanceOrderId={order.id}
          stages={order.stages.map((s) => ({
            id: s.id,
            label: s.label,
            expectedAmount: s.expectedAmount,
            dueDate: s.dueDate,
            sortOrder: s.sortOrder,
            status: s.status,
            paidAt: s.paidAt,
            paidAmount: s.paidAmount,
            currencyCode: s.currencyCode,
          }))}
          orderAmount={order.amount}
          currencyCode={order.currencyCode}
          accounts={accounts}
        />
      </div>

      {/* Payment history */}
      {linkedTxns.length > 0 && (
        <div className="section" style={{ padding: "var(--sp-3)", borderBottom: "1px solid var(--border)" }}>
          <div
            className="mono"
            style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginBottom: "var(--sp-2)", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}
          >
            {t("income.order_detail.payments_history")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-1)" }}>
            {linkedTxns.map((p) => (
              <div
                key={p.id}
                className="mono"
                style={{
                  display: "flex",
                  gap: "var(--sp-2)",
                  fontSize: "var(--text-xs)",
                  color: "var(--muted)",
                }}
              >
                <span style={{ flexShrink: 0 }}>{formatDate(p.occurredAt, locale)}</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}
                </span>
                <span style={{ color: "var(--pos)", flexShrink: 0 }}>
                  {formatMoney(p.amount, p.currencyCode)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete action */}
      <div style={{ padding: "var(--sp-3)" }}>
        <OrderDetailActions
          orderId={order.id}
          workSourceId={workSourceId}
          deleteLabel={t("income.order_detail.delete")}
          deleteConfirm={t("income.order_detail.delete_confirm")}
        />
      </div>
    </div>
  );
}
