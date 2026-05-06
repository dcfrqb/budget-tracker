"use client";

import React, { createContext, useContext, useState, useTransition, useCallback } from "react";
import { useT } from "@/lib/i18n";
import { markPairAsTransfer, breakTransfer } from "@/lib/data/_mutations/transfer-manual";
import type { TxnView } from "@/lib/view/transactions";

type SelectionContextValue = {
  selected: Set<string>;
  rowsMap: Map<string, TxnView>;
  toggle: (id: string, row: TxnView) => void;
  clear: () => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used inside TransactionsSelectionProvider");
  return ctx;
}

type ActionState = { kind: "idle" } | { kind: "success"; msgKey: string } | { kind: "error"; msgKey: string } | { kind: "warning"; msgKey: string };

export function TransactionsSelectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useT();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rowsMap, setRowsMap] = useState<Map<string, TxnView>>(new Map());
  const [actionState, setActionState] = useState<ActionState>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  const toggle = useCallback((id: string, row: TxnView) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setRowsMap((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.set(id, row);
      }
      return next;
    });
    setActionState({ kind: "idle" });
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
    setRowsMap(new Map());
    setActionState({ kind: "idle" });
  }, []);

  const selectedRows = Array.from(rowsMap.values());
  const count = selected.size;

  const canMarkAsTransfer =
    count === 2 &&
    selectedRows.every((r) => r.transferId === null) &&
    new Set(selectedRows.map((r) => r.accountId)).size === 2;

  const canBreakTransfer =
    count >= 1 &&
    selectedRows.every((r) => r.transferId !== null);

  const transferIds = Array.from(new Set(selectedRows.map((r) => r.transferId).filter(Boolean) as string[]));

  const markDisabledReason: string | null = (() => {
    if (count !== 2) return t("transactions.selection.tooltip.need_two");
    if (selectedRows.some((r) => r.transferId !== null)) return t("transactions.selection.tooltip.already_transfer");
    if (new Set(selectedRows.map((r) => r.accountId)).size !== 2) return t("transactions.selection.tooltip.same_account");
    return null;
  })();

  function handleMarkAsTransfer() {
    const ids = Array.from(selected);
    startTransition(async () => {
      const result = await markPairAsTransfer({ leftId: ids[0], rightId: ids[1] });
      if ("warning" in result && result.ok) {
        setActionState({ kind: "warning", msgKey: result.warning });
        setSelected(new Set());
        setRowsMap(new Map());
      } else if (result.ok) {
        setActionState({ kind: "success", msgKey: "transactions.selection.success.marked" });
        setSelected(new Set());
        setRowsMap(new Map());
      } else {
        setActionState({ kind: "error", msgKey: result.error });
      }
    });
  }

  function handleBreakTransfer() {
    startTransition(async () => {
      const results = await Promise.all(transferIds.map((id) => breakTransfer({ transferId: id })));
      const firstError = results.find((r) => !r.ok);
      if (firstError && !firstError.ok) {
        setActionState({ kind: "error", msgKey: firstError.error });
      } else {
        setActionState({ kind: "success", msgKey: "transactions.selection.success.broken" });
        setSelected(new Set());
        setRowsMap(new Map());
      }
    });
  }

  return (
    <SelectionContext.Provider value={{ selected, rowsMap, toggle, clear }}>
      {children}
      {count > 0 && (
        <div className="selection-action-bar" role="region" aria-label={t("transactions.selection.count", { vars: { count: String(count) } })}>
          <span className="selection-count mono dim">
            {t("transactions.selection.count", { vars: { count: String(count) } })}
          </span>

          <button
            type="button"
            className="btn"
            disabled={!canMarkAsTransfer || isPending}
            title={markDisabledReason ?? ""}
            onClick={handleMarkAsTransfer}
          >
            {t("transactions.selection.mark_as_transfer")}
          </button>

          <button
            type="button"
            className="btn"
            disabled={!canBreakTransfer || isPending}
            onClick={handleBreakTransfer}
          >
            {t("transactions.selection.break_transfer")}
          </button>

          <button
            type="button"
            className="btn"
            onClick={clear}
          >
            {t("transactions.selection.clear")}
          </button>

          {actionState.kind === "success" && (
            <div role="status" aria-live="polite" className="selection-msg acc">
              {t(actionState.msgKey as Parameters<typeof t>[0])}
            </div>
          )}
          {actionState.kind === "warning" && (
            <div role="status" aria-live="polite" className="selection-msg warn">
              {t(actionState.msgKey as Parameters<typeof t>[0])}
            </div>
          )}
          {actionState.kind === "error" && (
            <div role="alert" className="selection-msg neg">
              {t(actionState.msgKey as Parameters<typeof t>[0])}
            </div>
          )}
        </div>
      )}
    </SelectionContext.Provider>
  );
}
