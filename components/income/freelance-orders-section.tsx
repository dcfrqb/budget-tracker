"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { FreelanceOrder, FreelanceOrderStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { FreelanceOrderForm } from "@/components/forms/freelance-order-form";
import type { CurrencyOption } from "@/components/forms/currency-select";
import { useT, useLocale } from "@/lib/i18n";
import { formatMoney } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";

interface FreelanceOrdersSectionProps {
  workSourceId: string;
  workSourceCurrency: string;
  currencies: CurrencyOption[];
  initialOrders: FreelanceOrder[];
}

function StatusBadge({ status }: { status: FreelanceOrderStatus }) {
  const t = useT();
  const labelMap: Record<FreelanceOrderStatus, string> = {
    ACTIVE: t("forms.freelance_order.status.active"),
    AWAITING_PAYMENT: t("forms.freelance_order.status.awaiting_payment"),
    COMPLETED: t("forms.freelance_order.status.completed"),
    CANCELLED: t("forms.freelance_order.status.cancelled"),
  };
  const classMap: Record<FreelanceOrderStatus, string> = {
    ACTIVE: "fo-badge fo-badge--active",
    AWAITING_PAYMENT: "fo-badge fo-badge--awaiting",
    COMPLETED: "fo-badge fo-badge--completed",
    CANCELLED: "fo-badge fo-badge--cancelled",
  };
  return <span className={classMap[status]}>{labelMap[status]}</span>;
}

export function FreelanceOrdersSection({
  workSourceId,
  workSourceCurrency,
  currencies,
  initialOrders,
}: FreelanceOrdersSectionProps) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="section fade-in" style={{ marginTop: "var(--sp-6)" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("income.freelance_orders.section_title")}</b>
          <span className="dim"> · {initialOrders.length}</span>
        </div>
        {!showAddForm && (
          <button
            type="button"
            className="btn primary"
            style={{ padding: "3px 9px", fontSize: "var(--text-xs)" }}
            onClick={() => { setShowAddForm(true); setEditingId(null); }}
          >
            {t("income.freelance_orders.add")}
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="fo-form-wrap" style={{ marginBottom: "var(--sp-4)" }}>
          <FreelanceOrderForm
            mode="create"
            workSourceId={workSourceId}
            workSourceCurrency={workSourceCurrency}
            currencies={currencies}
            onSuccess={() => {
              setShowAddForm(false);
              router.refresh();
            }}
          />
        </div>
      )}

      <div className="section-body flush">
        {initialOrders.length === 0 && !showAddForm ? (
          <div className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--muted)", padding: "var(--space-3) var(--space-3)" }}>
            {t("income.freelance_orders.empty")}
          </div>
        ) : (
          <div className="fo-list">
            {initialOrders.map((order) => (
              <div key={order.id} className="fo-row">
                {editingId === order.id ? (
                  <div className="fo-form-wrap">
                    <FreelanceOrderForm
                      mode="edit"
                      workSourceId={workSourceId}
                      workSourceCurrency={workSourceCurrency}
                      currencies={currencies}
                      freelanceOrderId={order.id}
                      initialValues={{
                        workSourceId: order.workSourceId,
                        client: order.client ?? undefined,
                        amount: order.amount.toString(),
                        currencyCode: order.currencyCode,
                        hours: order.hours?.toString() ?? undefined,
                        hourlyRate: order.hourlyRate?.toString() ?? undefined,
                        tipsAmount: order.tipsAmount?.toString() ?? undefined,
                        status: order.status,
                        performedAt: order.performedAt
                          ? new Date(order.performedAt).toISOString().slice(0, 10)
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          : (undefined as any),
                        paidAt: order.paidAt
                          ? new Date(order.paidAt).toISOString().slice(0, 10)
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          : (undefined as any),
                        note: order.note ?? undefined,
                      }}
                      onSuccess={() => { setEditingId(null); router.refresh(); }}
                    />
                  </div>
                ) : (
                  <div className="fo-row-inner">
                    <div className="fo-row-main">
                      <div className="fo-row-client mono">
                        {order.client ?? "—"}
                      </div>
                      <div className="fo-row-amount mono pos">
                        {formatMoney(order.amount, order.currencyCode)}
                        {order.hours != null && order.hourlyRate != null && (
                          <span className="dim" style={{ fontSize: "var(--text-xs)", marginLeft: "var(--space-2)" }}>
                            ({new Prisma.Decimal(order.hours).toFixed(1)}h
                            {" "}×{" "}
                            {formatMoney(order.hourlyRate, order.currencyCode)})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="fo-row-meta">
                      <StatusBadge status={order.status} />
                      {order.performedAt && (
                        <span className="mono dim">
                          {formatDate(new Date(order.performedAt), locale)}
                        </span>
                      )}
                      {order.paidAt && (
                        <span className="mono dim">
                          {formatDate(new Date(order.paidAt), locale)}
                        </span>
                      )}
                      {order.tipsAmount && !new Prisma.Decimal(order.tipsAmount).isZero() && (
                        <span className="mono acc">
                          +{formatMoney(order.tipsAmount, order.currencyCode)}
                        </span>
                      )}
                      {order.note && (
                        <span className="mono dim" style={{ fontStyle: "italic" }}>
                          {order.note}
                        </span>
                      )}
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ padding: "2px 8px", fontSize: "var(--text-xs)" }}
                        onClick={() => { setEditingId(order.id); setShowAddForm(false); }}
                      >
                        {t("forms.common.edit")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
