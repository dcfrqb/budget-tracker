"use client";

import { useState, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { FreelanceOrderForm } from "@/components/forms/freelance-order-form";
import type { WorkSourceFreelanceOrder } from "@/lib/data/work-sources";
import { FreelanceOrdersPanelRows } from "./freelance-orders-panel-rows";
import { FreelanceOrdersGrid } from "./freelance-orders-grid";
import type { CurrencyOption } from "@/components/forms/currency-select";
import type { AccountOption } from "./freelance-order-stages";

const LS_KEY = "bdg:freelance-orders-view";

type ViewMode = "cards" | "table";

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
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored === "cards" || stored === "table") {
        setViewMode(stored as ViewMode);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  function switchView(mode: ViewMode) {
    setViewMode(mode);
    try {
      localStorage.setItem(LS_KEY, mode);
    } catch {
      // ignore
    }
  }

  const canAdd = !!(workSourceId && workSourceCurrency && currencies);

  return (
    <div className="section" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{titleLabel}</b>
          <span className="dim"> · {orders.length}</span>
        </div>

        <div className="orders-view-toggle">
          {/* View toggle */}
          <div className="segmented-control" role="tablist">
            <button
              type="button"
              role="tab"
              className={`seg-btn${viewMode === "cards" ? " active" : ""}`}
              aria-selected={viewMode === "cards"}
              onClick={() => switchView("cards")}
            >
              {t("income.work.detail.orders.grid.view.cards")}
            </button>
            <button
              type="button"
              role="tab"
              className={`seg-btn${viewMode === "table" ? " active" : ""}`}
              aria-selected={viewMode === "table"}
              onClick={() => switchView("table")}
            >
              {t("income.work.detail.orders.grid.view.table")}
            </button>
          </div>

          {/* Add button — only in cards view */}
          {canAdd && viewMode === "cards" && (
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
      </div>

      {/* Add-order form — full width, below header (cards view only) */}
      {showForm && canAdd && viewMode === "cards" && (
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
        {viewMode === "cards" ? (
          orders.length === 0 ? (
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
          )
        ) : (
          <FreelanceOrdersGrid
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
