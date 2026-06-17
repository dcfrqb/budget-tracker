"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { FreelanceOrderForm } from "@/components/forms/freelance-order-form";
import type { WorkSourceFreelanceOrder } from "@/lib/data/work-sources";
import { FreelanceOrdersPanelRows } from "./freelance-orders-panel-rows";
import type { CurrencyOption } from "@/components/forms/currency-select";
import type { AccountOption } from "./freelance-order-stages";

interface Props {
  orders: WorkSourceFreelanceOrder[];
  workSourceId?: string;
  workSourceCurrency?: string;
  currencies?: CurrencyOption[];
  accounts?: AccountOption[];
  userId?: string;
  emptyLabel: string;
  titleLabel: string;
  addLabel: string;
  cancelLabel: string;
}

export function FreelanceOrdersPanel({
  orders,
  workSourceId,
  workSourceCurrency,
  currencies,
  accounts,
  emptyLabel,
  titleLabel,
  addLabel,
  cancelLabel,
}: Props) {
  const t = useT();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  const canAdd = !!(workSourceId && workSourceCurrency && currencies);

  return (
    <div className="section" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{titleLabel}</b>
          <span className="dim"> · {orders.length}</span>
        </div>
        {canAdd && (
          <button
            type="button"
            className="btn primary"
            style={{ padding: "var(--sp-1) var(--sp-3)", fontSize: "var(--text-xs)" }}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? cancelLabel : addLabel}
          </button>
        )}
      </div>

      {/* Add-order form — full width, below the header */}
      {showForm && canAdd && (
        <div
          style={{
            padding: "var(--sp-3)",
            borderBottom: "1px solid var(--border)",
            background: "var(--panel-2)",
          }}
        >
          <FreelanceOrderForm
            mode="create"
            workSourceId={workSourceId!}
            workSourceCurrency={workSourceCurrency!}
            currencies={currencies!}
            onSuccess={() => {
              setShowForm(false);
              router.refresh();
            }}
          />
        </div>
      )}

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
            {emptyLabel}
          </div>
        ) : (
          <FreelanceOrdersPanelRows
            orders={orders}
            workSourceId={workSourceId ?? ""}
            workSourceCurrency={workSourceCurrency ?? ""}
            currencies={currencies ?? []}
            accounts={accounts ?? []}
          />
        )}
      </div>
    </div>
  );
}
