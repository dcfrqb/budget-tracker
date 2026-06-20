"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { confirmReimbursementAction } from "@/app/(shell)/expenses/subscriptions/actions";

export type ReimbursementSuggestionRow = {
  subscriptionId: string;
  subscriptionName: string;
  subscriptionReimbursementFrom: string | null;
  incomeId: string;
  incomeName: string;
  incomeAmount: string;
  incomeCurrencyCode: string;
  incomeDate: string;
  spendId: string | null;
  spendAmount: string | null;
  spendCurrencyCode: string | null;
  spendDate: string | null;
  reason: "amount_match" | "amount_and_name_match";
};

type Props = {
  suggestions: ReimbursementSuggestionRow[];
};

export function ReimbursementSuggestions({ suggestions }: Props) {
  const t = useT();
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const visible = suggestions.filter((s) => !dismissed.has(rowKey(s)));

  if (visible.length === 0) return null;

  function rowKey(s: ReimbursementSuggestionRow) {
    return `${s.incomeId}:${s.subscriptionId}`;
  }

  function handleDismiss(s: ReimbursementSuggestionRow) {
    setDismissed((prev) => new Set([...prev, rowKey(s)]));
  }

  function handleConfirm(s: ReimbursementSuggestionRow) {
    const spendId = s.spendId;
    if (!spendId) return;
    const key = rowKey(s);
    setConfirming((prev) => new Set([...prev, key]));
    startTransition(async () => {
      await confirmReimbursementAction({
        incomeTransactionId: s.incomeId,
        spendTransactionId: spendId,
      });
      setDismissed((prev) => new Set([...prev, key]));
      setConfirming((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      router.refresh();
    });
  }

  function reasonLabel(reason: ReimbursementSuggestionRow["reason"]): string {
    if (reason === "amount_and_name_match") {
      return t("expenses.subscriptions.reimbursement.reason_amount_and_name_match");
    }
    return t("expenses.subscriptions.reimbursement.reason_amount_match");
  }

  return (
    <div className="section fade-in" style={{ marginBottom: "var(--space-4)" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("expenses.subscriptions.reimbursement.section_title")}</b>
        </div>
      </div>
      <div
        className="section-body"
        style={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        {visible.map((s) => {
          const key = rowKey(s);
          const isConfirming = confirming.has(key);
          const canConfirm = !!s.spendId;

          return (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "10px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {/* Details column */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {/* Income row */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span
                    className="mono"
                    style={{ fontSize: "var(--text-xs)", color: "var(--muted)", minWidth: 60 }}
                  >
                    {t("expenses.subscriptions.reimbursement.income_label")}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.incomeName}
                  </span>
                  <span className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--accent)", whiteSpace: "nowrap" }}>
                    {s.incomeAmount} {s.incomeCurrencyCode}
                  </span>
                  <span className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--muted)", whiteSpace: "nowrap" }}>
                    {s.incomeDate}
                  </span>
                </div>

                {/* Subscription row */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span
                    className="mono"
                    style={{ fontSize: "var(--text-xs)", color: "var(--muted)", minWidth: 60 }}
                  >
                    {t("expenses.subscriptions.reimbursement.sub_label")}
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: "var(--text-sm)", color: "var(--text)" }}
                  >
                    {s.subscriptionName}
                  </span>
                  {s.subscriptionReimbursementFrom && (
                    <span className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>
                      {t("expenses.subscriptions.reimbursement.from_label", {
                        vars: { name: s.subscriptionReimbursementFrom },
                      })}
                    </span>
                  )}
                </div>

                {/* Spend row — only when present */}
                {s.spendId && s.spendAmount && s.spendCurrencyCode && s.spendDate && (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span
                      className="mono"
                      style={{ fontSize: "var(--text-xs)", color: "var(--muted)", minWidth: 60 }}
                    >
                      {t("expenses.subscriptions.reimbursement.spend_label")}
                    </span>
                    <span className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                      {s.spendAmount} {s.spendCurrencyCode}
                    </span>
                    <span className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {s.spendDate}
                    </span>
                  </div>
                )}

                {/* No-spend hint */}
                {!canConfirm && (
                  <span className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>
                    {t("expenses.subscriptions.reimbursement.no_spend_hint")}
                  </span>
                )}
              </div>

              {/* Reason badge */}
              <span
                className="mono"
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--muted)",
                  background: "var(--panel-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 3,
                  padding: "1px 6px",
                  whiteSpace: "nowrap",
                  alignSelf: "center",
                }}
              >
                {reasonLabel(s.reason)}
              </span>

              {/* Confirm */}
              <button
                type="button"
                className="btn-primary"
                style={{ fontSize: "var(--text-xs)", padding: "4px 10px", whiteSpace: "nowrap", alignSelf: "center" }}
                disabled={isPending || isConfirming || !canConfirm}
                onClick={() => handleConfirm(s)}
                title={canConfirm ? undefined : t("expenses.subscriptions.reimbursement.no_spend_hint")}
              >
                {isConfirming
                  ? "..."
                  : t("expenses.subscriptions.reimbursement.confirm", {
                      vars: { name: s.subscriptionName },
                    })}
              </button>

              {/* Dismiss */}
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: "var(--text-xs)", padding: "4px 8px", whiteSpace: "nowrap", alignSelf: "center" }}
                disabled={isPending}
                onClick={() => handleDismiss(s)}
              >
                {t("expenses.subscriptions.reimbursement.dismiss")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
