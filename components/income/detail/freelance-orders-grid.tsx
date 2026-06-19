"use client";

import { useState, useTransition, useRef, Fragment } from "react";
import { Prisma, FreelanceOrderStatus, FreelanceOrderStageStatus } from "@prisma/client";
import { useT } from "@/lib/i18n";
import { formatMoney } from "@/lib/format/money";
import {
  updateFreelanceOrderAction,
  createFreelanceOrderAction,
  deleteFreelanceOrderAction,
} from "@/app/(shell)/income/actions";
import { FreelanceOrderQuickEdit } from "./freelance-order-quick-edit";
import type { WorkSourceFreelanceOrder } from "@/lib/data/work-sources";
import type { CurrencyOption } from "@/components/forms/currency-select";
import type { AccountOption } from "./freelance-order-stages";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface Props {
  orders: WorkSourceFreelanceOrder[];
  workSourceId: string;
  workSourceCurrency: string;
  currencies: CurrencyOption[];
  accounts: AccountOption[];
}

type OrderRow = WorkSourceFreelanceOrder;

const STATUS_OPTIONS = [
  FreelanceOrderStatus.PLANNED,
  FreelanceOrderStatus.ACTIVE,
  FreelanceOrderStatus.AWAITING_PAYMENT,
  FreelanceOrderStatus.COMPLETED,
  FreelanceOrderStatus.CANCELLED,
];

// ─────────────────────────────────────────────────────────────
// Module-level cell components (hoisted to prevent remount on every render)
// ─────────────────────────────────────────────────────────────

interface CellTextProps {
  orderId: string;
  field: string;
  value: string;
  display: string;
  align?: "right";
  editingCell: { id: string; field: string } | null;
  editValue: string;
  setEditValue: (v: string) => void;
  startEdit: (id: string, field: string, current: string) => void;
  commitEdit: (id: string, field: string, value: string) => void;
  cancelEdit: () => void;
  editHint: string;
}

function CellText({
  orderId,
  field,
  value,
  display,
  align,
  editingCell,
  editValue,
  setEditValue,
  startEdit,
  commitEdit,
  cancelEdit,
  editHint,
}: CellTextProps) {
  const isEditing = editingCell?.id === orderId && editingCell?.field === field;

  if (isEditing) {
    return (
      <input
        className="inline-edit-input"
        value={editValue}
        autoFocus
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => commitEdit(orderId, field, editValue)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitEdit(orderId, field, editValue);
          } else if (e.key === "Escape") {
            cancelEdit();
          }
        }}
        style={{ width: "100%", boxSizing: "border-box" }}
      />
    );
  }

  return (
    <span
      className="editable-cell"
      style={align === "right" ? { textAlign: "right" } : undefined}
      title={editHint}
      onClick={() => startEdit(orderId, field, value)}
    >
      {display || "—"}
    </span>
  );
}

interface CellSelectProps {
  orderId: string;
  field: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  display: string;
  editingCell: { id: string; field: string } | null;
  editValue: string;
  setEditValue: (v: string) => void;
  startEdit: (id: string, field: string, current: string) => void;
  commitEdit: (id: string, field: string, value: string) => void;
  cancelEdit: () => void;
  editHint: string;
}

function CellSelect({
  orderId,
  field,
  value,
  options,
  display,
  editingCell,
  editValue,
  setEditValue,
  startEdit,
  commitEdit,
  cancelEdit,
  editHint,
}: CellSelectProps) {
  const isEditing = editingCell?.id === orderId && editingCell?.field === field;

  if (isEditing) {
    return (
      <select
        className="inline-edit-input"
        value={editValue}
        autoFocus
        onChange={(e) => {
          const v = e.target.value;
          setEditValue(v);
          commitEdit(orderId, field, v);
        }}
        onBlur={() => commitEdit(orderId, field, editValue)}
        onKeyDown={(e) => {
          if (e.key === "Escape") cancelEdit();
        }}
        style={{ width: "100%", boxSizing: "border-box" }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <span
      className="editable-cell"
      title={editHint}
      onClick={() => startEdit(orderId, field, value)}
    >
      {display || "—"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Money normalization — mirrors the form's logic
// ─────────────────────────────────────────────────────────────

function normalizeMoneyField(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (Number.isNaN(n)) return null;
  return String(n);
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function FreelanceOrdersGrid({
  orders: initialOrders,
  workSourceId,
  workSourceCurrency,
  currencies,
  accounts,
}: Props) {
  const t = useT();
  const [, startTransition] = useTransition();

  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const ordersRef = useRef<OrderRow[]>(initialOrders);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Inline editing: { id, field }
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Add-row state
  const [addTitle, setAddTitle] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addPending, setAddPending] = useState(false);

  function updateOrders(updater: (prev: OrderRow[]) => OrderRow[]) {
    setOrders((prev) => {
      const next = updater(prev);
      ordersRef.current = next;
      return next;
    });
  }

  // ─── Inline edit helpers ────────────────────────────────────

  function startEdit(id: string, field: string, current: string) {
    setEditingCell({ id, field });
    setEditValue(current);
  }

  function cancelEdit() {
    setEditingCell(null);
    setEditValue("");
  }

  function commitEdit(id: string, field: string, value: string) {
    setEditingCell(null);
    setEditValue("");

    if (field === "title" && !value.trim()) return;

    // Build patch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = {};
    if (field === "title") patch.title = value.trim();
    else if (field === "client") patch.client = value.trim() || null;
    else if (field === "status") patch.status = value as FreelanceOrderStatus;
    else if (field === "currencyCode") patch.currencyCode = value;
    else if (field === "amount") {
      const norm = normalizeMoneyField(value);
      if (norm === null) return;
      patch.amount = norm;
    } else if (field === "hours") {
      patch.hours = normalizeMoneyField(value);
    } else if (field === "hourlyRate") {
      patch.hourlyRate = normalizeMoneyField(value);
    } else if (field === "tipsAmount") {
      patch.tipsAmount = normalizeMoneyField(value);
    } else if (field === "performedAt") {
      patch.performedAt = value || null;
    } else if (field === "paidAt") {
      patch.paidAt = value || null;
    } else if (field === "note") {
      patch.note = value.trim() || null;
    } else {
      return;
    }

    // Capture snapshot for revert (from current ref, not stale closure)
    const snapshot = ordersRef.current.find((o) => o.id === id);

    // Optimistic update
    updateOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        return { ...o, ...patch } as OrderRow;
      }),
    );

    startTransition(async () => {
      const result = await updateFreelanceOrderAction(id, patch);
      if (!result.ok && snapshot) {
        updateOrders((prev) =>
          prev.map((o) => (o.id === id ? snapshot : o)),
        );
      }
    });
  }

  // ─── Delete ─────────────────────────────────────────────────

  function handleDelete(id: string) {
    const restored = ordersRef.current.find((o) => o.id === id);
    updateOrders((prev) => prev.filter((o) => o.id !== id));
    startTransition(async () => {
      const result = await deleteFreelanceOrderAction(id);
      if (!result.ok && restored) {
        updateOrders((prev) => [...prev, restored].sort((a, b) => (a.id < b.id ? 1 : -1)));
      }
    });
  }

  // ─── Add row ────────────────────────────────────────────────

  async function handleAddRow(e: React.FormEvent) {
    e.preventDefault();
    if (!addTitle.trim()) return;
    const normAmount = normalizeMoneyField(addAmount);
    if (!normAmount) return;

    setAddPending(true);
    const result = await createFreelanceOrderAction({
      workSourceId,
      currencyCode: workSourceCurrency,
      status: FreelanceOrderStatus.ACTIVE,
      title: addTitle.trim(),
      amount: normAmount,
    });
    setAddPending(false);

    if (result.ok) {
      const created = result.data as OrderRow & {
        paidSum: Prisma.Decimal;
        paidCount: number;
        paidCountOtherCcy: number;
      };
      const newRow: OrderRow = {
        ...created,
        paidSum: new Prisma.Decimal(created.paidSum ?? 0),
        stages: created.stages ?? [],
      } as OrderRow;
      updateOrders((prev) => [...prev, newRow]);
      setAddTitle("");
      setAddAmount("");
    }
  }

  // ─── Display helpers ────────────────────────────────────────

  function getReceived(order: OrderRow): Prisma.Decimal {
    const hasStages = order.stages.length > 0;
    if (hasStages) {
      return order.stages
        .filter((s) => s.status === FreelanceOrderStageStatus.PAID && s.paidAmount != null)
        .reduce((sum, s) => sum.plus(new Prisma.Decimal(s.paidAmount!)), new Prisma.Decimal(0));
    }
    return new Prisma.Decimal(order.paidSum);
  }

  function getOrderTitle(order: OrderRow): string {
    return (order as unknown as { title?: string }).title ?? order.client ?? "—";
  }

  const colCount = 15;

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="orders-grid-wrap">
      <table className="orders-grid">
        <thead>
          <tr>
            <th style={{ width: 20 }}></th>
            <th>{t("income.work.detail.orders.grid.col.title")}</th>
            <th>{t("income.work.detail.orders.grid.col.client")}</th>
            <th>{t("income.work.detail.orders.grid.col.status")}</th>
            <th className="num">{t("income.work.detail.orders.grid.col.amount")}</th>
            <th>{t("income.work.detail.orders.grid.col.currency")}</th>
            <th className="num">{t("income.work.detail.orders.grid.col.hours")}</th>
            <th className="num">{t("income.work.detail.orders.grid.col.rate")}</th>
            <th className="num">{t("income.work.detail.orders.grid.col.tips")}</th>
            <th>{t("income.work.detail.orders.grid.col.performed")}</th>
            <th>{t("income.work.detail.orders.grid.col.paid")}</th>
            <th>{t("income.work.detail.orders.grid.col.note")}</th>
            <th className="num">{t("income.work.detail.orders.grid.col.received")}</th>
            <th className="num">{t("income.work.detail.orders.grid.col.remaining")}</th>
            <th style={{ width: 28 }}></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const orderTitle = getOrderTitle(order);
            const amount = new Prisma.Decimal(order.amount);
            const tips = order.tipsAmount ? new Prisma.Decimal(order.tipsAmount) : null;
            const hours = order.hours ? new Prisma.Decimal(order.hours) : null;
            const hourlyRate = order.hourlyRate ? new Prisma.Decimal(order.hourlyRate) : null;
            const received = getReceived(order);
            const remaining = amount.minus(received).lt(0)
              ? new Prisma.Decimal(0)
              : amount.minus(received);
            const isExpanded = expandedId === order.id;
            const editHint = t("income.work.detail.orders.grid.edit_hint");
            const cellProps = { editingCell, editValue, setEditValue, startEdit, commitEdit, cancelEdit, editHint };

            return (
              <Fragment key={order.id}>
                <tr>
                  {/* Expand chevron */}
                  <td
                    className="orders-grid-chevron"
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    title={isExpanded ? "▲" : "▼"}
                  >
                    {isExpanded ? "▲" : "▼"}
                  </td>

                  {/* Title */}
                  <td>
                    <CellText
                      orderId={order.id}
                      field="title"
                      value={orderTitle === "—" ? "" : orderTitle}
                      display={orderTitle}
                      {...cellProps}
                    />
                  </td>

                  {/* Client */}
                  <td>
                    <CellText
                      orderId={order.id}
                      field="client"
                      value={order.client ?? ""}
                      display={order.client ?? ""}
                      {...cellProps}
                    />
                  </td>

                  {/* Status */}
                  <td>
                    <CellSelect
                      orderId={order.id}
                      field="status"
                      value={order.status}
                      display={t(
                        `income.work.detail.orders.status.${order.status.toLowerCase()}` as Parameters<typeof t>[0],
                      )}
                      options={STATUS_OPTIONS.map((s) => ({
                        value: s,
                        label: t(
                          `income.work.detail.orders.status.${s.toLowerCase()}` as Parameters<typeof t>[0],
                        ),
                      }))}
                      {...cellProps}
                    />
                  </td>

                  {/* Amount */}
                  <td className="num">
                    <CellText
                      orderId={order.id}
                      field="amount"
                      value={amount.toFixed(2)}
                      display={formatMoney(amount, order.currencyCode)}
                      align="right"
                      {...cellProps}
                    />
                  </td>

                  {/* Currency */}
                  <td>
                    <CellSelect
                      orderId={order.id}
                      field="currencyCode"
                      value={order.currencyCode}
                      display={order.currencyCode}
                      options={currencies.map((c) => ({ value: c.code, label: c.code }))}
                      {...cellProps}
                    />
                  </td>

                  {/* Hours */}
                  <td className="num">
                    <CellText
                      orderId={order.id}
                      field="hours"
                      value={hours ? hours.toFixed(2) : ""}
                      display={hours ? hours.toFixed(1) : ""}
                      align="right"
                      {...cellProps}
                    />
                  </td>

                  {/* Hourly rate */}
                  <td className="num">
                    <CellText
                      orderId={order.id}
                      field="hourlyRate"
                      value={hourlyRate ? hourlyRate.toFixed(2) : ""}
                      display={hourlyRate ? formatMoney(hourlyRate, order.currencyCode) : ""}
                      align="right"
                      {...cellProps}
                    />
                  </td>

                  {/* Tips */}
                  <td className="num">
                    <CellText
                      orderId={order.id}
                      field="tipsAmount"
                      value={tips ? tips.toFixed(2) : ""}
                      display={tips && tips.gt(0) ? formatMoney(tips, order.currencyCode) : ""}
                      align="right"
                      {...cellProps}
                    />
                  </td>

                  {/* Performed at */}
                  <td>
                    <CellText
                      orderId={order.id}
                      field="performedAt"
                      value={
                        order.performedAt instanceof Date
                          ? order.performedAt.toISOString().slice(0, 10)
                          : typeof order.performedAt === "string"
                          ? (order.performedAt as string).slice(0, 10)
                          : ""
                      }
                      display={
                        order.performedAt
                          ? (order.performedAt instanceof Date
                              ? order.performedAt.toISOString()
                              : String(order.performedAt)
                            ).slice(0, 10)
                          : ""
                      }
                      {...cellProps}
                    />
                  </td>

                  {/* Paid at */}
                  <td>
                    <CellText
                      orderId={order.id}
                      field="paidAt"
                      value={
                        order.paidAt instanceof Date
                          ? order.paidAt.toISOString().slice(0, 10)
                          : typeof order.paidAt === "string"
                          ? (order.paidAt as string).slice(0, 10)
                          : ""
                      }
                      display={
                        order.paidAt
                          ? (order.paidAt instanceof Date
                              ? order.paidAt.toISOString()
                              : String(order.paidAt)
                            ).slice(0, 10)
                          : ""
                      }
                      {...cellProps}
                    />
                  </td>

                  {/* Note */}
                  <td>
                    <CellText
                      orderId={order.id}
                      field="note"
                      value={order.note ?? ""}
                      display={order.note ?? ""}
                      {...cellProps}
                    />
                  </td>

                  {/* Received (read-only) */}
                  <td className="num" style={{ color: "var(--pos)", fontVariantNumeric: "tabular-nums" }}>
                    {formatMoney(received, order.currencyCode)}
                  </td>

                  {/* Remaining (read-only) */}
                  <td
                    className="num"
                    style={{
                      color: remaining.gt(0) ? "var(--warn)" : "var(--muted)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatMoney(remaining, order.currencyCode)}
                  </td>

                  {/* Delete */}
                  <td className="orders-grid-actions">
                    <button
                      type="button"
                      className="orders-grid-delete-btn"
                      onClick={() => handleDelete(order.id)}
                      aria-label={t("forms.freelance_order.delete")}
                    >
                      ✕
                    </button>
                  </td>
                </tr>

                {/* Expanded quick-edit row */}
                {isExpanded && (
                  <tr className="orders-grid-expandrow">
                    <td colSpan={colCount}>
                      <FreelanceOrderQuickEdit
                        order={order}
                        workSourceId={workSourceId}
                        workSourceCurrency={workSourceCurrency}
                        currencies={currencies}
                        accounts={accounts}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}

          {/* Add row */}
          <tr className="orders-grid-addrow">
            <td></td>
            <td colSpan={2}>
              <form onSubmit={handleAddRow} style={{ display: "flex", gap: "var(--sp-1)", alignItems: "center" }}>
                <input
                  className="inline-edit-input"
                  placeholder={t("income.work.detail.orders.grid.col.title")}
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  style={{ flex: 1, minWidth: 80 }}
                  disabled={addPending}
                />
                <input
                  className="inline-edit-input"
                  placeholder={t("income.work.detail.orders.grid.col.amount")}
                  inputMode="decimal"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  style={{ width: 80 }}
                  disabled={addPending}
                />
                <button
                  type="submit"
                  className="btn-ghost"
                  style={{ fontSize: "var(--text-xs)", padding: "2px 8px", whiteSpace: "nowrap" }}
                  disabled={addPending || !addTitle.trim() || !addAmount.trim()}
                >
                  {t("income.work.detail.orders.grid.add_row")}
                </button>
              </form>
            </td>
            <td colSpan={colCount - 3}></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
