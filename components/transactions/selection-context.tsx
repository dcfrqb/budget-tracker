"use client";

import React, { createContext, useContext, useState, useTransition, useCallback } from "react";
import { useT } from "@/lib/i18n";
import { markPairAsTransfer, breakTransfer } from "@/lib/data/_mutations/transfer-manual";
import { createCompensationGroup, breakCompensationGroup } from "@/lib/data/_mutations/compensations";
import { makeMergeAction } from "@/app/(shell)/transactions/compensation-actions";
import { SubscriptionFromSelectionDialog } from "@/components/transactions/subscription-from-selection-dialog";
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
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);

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

  // ── Transfer eligibility ──────────────────────────────────
  const canMarkAsTransfer =
    count === 2 &&
    selectedRows.every((r) => r.transferId === null) &&
    selectedRows.every((r) => r.compensationGroupId === null) &&
    new Set(selectedRows.map((r) => r.accountId)).size === 2;

  const markDisabledReason: string | null = (() => {
    if (count !== 2) return t("transactions.selection.tooltip.need_two");
    if (selectedRows.some((r) => r.compensationGroupId !== null)) return t("transactions.selection.tooltip.already_grouped");
    if (selectedRows.some((r) => r.transferId !== null)) return t("transactions.selection.tooltip.already_transfer");
    if (new Set(selectedRows.map((r) => r.accountId)).size !== 2) return t("transactions.selection.tooltip.same_account");
    return null;
  })();

  // ── Compensation eligibility ──────────────────────────────
  const hasExpense = selectedRows.some((r) => r.kind === "exp");
  const hasIncome = selectedRows.some((r) => r.kind === "inc");
  const allUnlinked = selectedRows.every((r) => r.transferId === null && r.compensationGroupId === null);

  const canMarkAsCompensation =
    count >= 2 &&
    allUnlinked &&
    hasExpense &&
    hasIncome;

  const compensationDisabledReason: string | null = (() => {
    if (count < 2) return t("transactions.selection.tooltip.need_two");
    if (selectedRows.some((r) => r.transferId !== null)) return t("transactions.selection.tooltip.already_transfer");
    if (selectedRows.some((r) => r.compensationGroupId !== null)) return t("transactions.selection.tooltip.already_grouped");
    if (!hasExpense || !hasIncome) return t("transactions.selection.tooltip.need_mixed_kinds");
    return null;
  })();

  // ── Merge eligibility ────────────────────────────────────
  // Use direction (in/out) to match server-side INFLOW_KINDS/OUTFLOW_KINDS check.
  // This allows same-direction DEBT_IN, DEBT_OUT, LOAN_PAYMENT merges too.
  const allInflow = selectedRows.every((r) => r.direction === "in");
  const allOutflow = selectedRows.every((r) => r.direction === "out");
  const allSameSign = allInflow || allOutflow;

  const canMerge =
    count >= 2 &&
    allUnlinked &&
    allSameSign;

  const mergeDisabledReason: string | null = (() => {
    if (count < 2) return t("transactions.selection.tooltip.need_two");
    if (selectedRows.some((r) => r.transferId !== null)) return t("transactions.selection.tooltip.already_transfer");
    if (selectedRows.some((r) => r.compensationGroupId !== null)) return t("transactions.selection.tooltip.already_grouped");
    if (!allSameSign) return t("transactions.merge.tooltip.need_same_sign");
    return null;
  })();

  // ── Subscription eligibility ──────────────────────────────
  const expenseRows = selectedRows.filter((r) => r.kind === "exp");
  const canLinkSubscription =
    count >= 1 &&
    expenseRows.length >= 1 &&
    expenseRows.every((r) => r.subscriptionId === null);

  const subscriptionDisabledReason: string | null = (() => {
    if (expenseRows.length === 0) return t("transactions.selection.subscription.tooltip_need_expense");
    if (expenseRows.some((r) => r.subscriptionId !== null)) return t("transactions.selection.subscription.tooltip_already_linked");
    return null;
  })();

  // Default currency for subscription dialog: most common among selected expense rows
  const subscriptionDefaultCurrency = (() => {
    const freq = new Map<string, number>();
    for (const r of expenseRows) {
      freq.set(r.currencyCode, (freq.get(r.currencyCode) ?? 0) + 1);
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "RUB";
  })();

  // ── Break eligibility ─────────────────────────────────────
  const allHaveTransfer = count >= 1 && selectedRows.every((r) => r.transferId !== null);
  const allHaveCompensation = count >= 1 && selectedRows.every((r) => r.compensationGroupId !== null);
  const mixedBreakTypes =
    selectedRows.some((r) => r.transferId !== null) &&
    selectedRows.some((r) => r.compensationGroupId !== null);

  const canBreak = (allHaveTransfer || allHaveCompensation) && !mixedBreakTypes;

  const breakDisabledReason: string | null = (() => {
    if (count < 1) return null;
    if (mixedBreakTypes) return t("transactions.selection.tooltip.break_mixed");
    if (!allHaveTransfer && !allHaveCompensation) return t("transactions.selection.tooltip.break_link");
    return null;
  })();

  const transferIds = Array.from(new Set(selectedRows.map((r) => r.transferId).filter(Boolean) as string[]));
  const compensationGroupIds = Array.from(new Set(selectedRows.map((r) => r.compensationGroupId).filter(Boolean) as string[]));

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

  function handleMarkAsCompensation() {
    const ids = Array.from(selected);
    startTransition(async () => {
      const result = await createCompensationGroup({ txnIds: ids });
      if (result.ok) {
        setActionState({ kind: "success", msgKey: "transactions.selection.success.compensation_made" });
        setSelected(new Set());
        setRowsMap(new Map());
      } else {
        setActionState({ kind: "error", msgKey: result.error });
      }
    });
  }

  function handleMakeMerge() {
    const ids = Array.from(selected);
    startTransition(async () => {
      const result = await makeMergeAction({ txnIds: ids });
      if (result.ok) {
        setActionState({ kind: "success", msgKey: "transactions.merge.success.merged" });
        setSelected(new Set());
        setRowsMap(new Map());
      } else {
        setActionState({ kind: "error", msgKey: result.error });
      }
    });
  }

  function handleBreak() {
    startTransition(async () => {
      if (allHaveTransfer) {
        const results = await Promise.all(transferIds.map((id) => breakTransfer({ transferId: id })));
        const firstError = results.find((r) => !r.ok);
        if (firstError && !firstError.ok) {
          setActionState({ kind: "error", msgKey: firstError.error });
        } else {
          setActionState({ kind: "success", msgKey: "transactions.selection.success.broken" });
          setSelected(new Set());
          setRowsMap(new Map());
        }
      } else if (allHaveCompensation) {
        const results = await Promise.all(
          compensationGroupIds.map((id) => breakCompensationGroup({ groupId: id })),
        );
        const firstError = results.find((r) => !r.ok);
        if (firstError && !firstError.ok) {
          setActionState({ kind: "error", msgKey: firstError.error });
        } else {
          setActionState({ kind: "success", msgKey: "transactions.selection.success.compensation_broken" });
          setSelected(new Set());
          setRowsMap(new Map());
        }
      }
    });
  }

  function handleSubscriptionSuccess(msgKey: string) {
    setActionState({ kind: "success", msgKey });
    setSelected(new Set());
    setRowsMap(new Map());
  }

  return (
    <SelectionContext.Provider value={{ selected, rowsMap, toggle, clear }}>
      {children}
      <SubscriptionFromSelectionDialog
        open={subscriptionDialogOpen}
        onOpenChange={setSubscriptionDialogOpen}
        transactionIds={expenseRows.map((r) => r.id)}
        defaultCurrencyCode={subscriptionDefaultCurrency}
        onSuccess={handleSubscriptionSuccess}
      />
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
            disabled={!canMarkAsCompensation || isPending}
            title={compensationDisabledReason ?? ""}
            onClick={handleMarkAsCompensation}
          >
            {t("transactions.selection.mark_as_compensation")}
          </button>

          <button
            type="button"
            className="btn"
            disabled={!canMerge || isPending}
            title={mergeDisabledReason ?? ""}
            onClick={handleMakeMerge}
          >
            {t("transactions.merge.action_label")}
          </button>

          <button
            type="button"
            className="btn"
            disabled={!canLinkSubscription || isPending}
            title={subscriptionDisabledReason ?? ""}
            onClick={() => setSubscriptionDialogOpen(true)}
          >
            {t("transactions.selection.subscription.action")}
          </button>

          <button
            type="button"
            className="btn"
            disabled={!canBreak || isPending}
            title={breakDisabledReason ?? ""}
            onClick={handleBreak}
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
