"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { confirmSubscriptionMatchAction } from "@/app/(shell)/expenses/subscriptions/actions";

export type SuggestionRow = {
  transactionId: string;
  transactionName: string;
  transactionAmount: string;
  transactionCurrencyCode: string;
  transactionDate: string;
  subscriptionId: string;
  subscriptionName: string;
  subscriptionPrice: string;
  subscriptionCurrencyCode: string;
  reason: "alias_ambiguous" | "similarity" | "amount_date";
  /** Number of unlinked charges collapsed into this suggestion (>1 means confirming covers more) */
  count: number;
};

type Props = {
  suggestions: SuggestionRow[];
};

export function MatchSuggestions({ suggestions }: Props) {
  const t = useT();
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const visible = suggestions.filter(
    (s) => !dismissed.has(`${s.transactionId}:${s.subscriptionId}`),
  );

  if (visible.length === 0) return null;

  function pairKey(s: SuggestionRow) {
    return `${s.transactionId}:${s.subscriptionId}`;
  }

  function handleDismiss(s: SuggestionRow) {
    setDismissed((prev) => new Set([...prev, pairKey(s)]));
  }

  function handleConfirm(s: SuggestionRow) {
    const key = pairKey(s);
    setConfirming((prev) => new Set([...prev, key]));
    startTransition(async () => {
      await confirmSubscriptionMatchAction({
        transactionId: s.transactionId,
        subscriptionId: s.subscriptionId,
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

  function reasonLabel(reason: SuggestionRow["reason"]): string {
    if (reason === "alias_ambiguous") return t("expenses.subscriptions.suggestions.reason_alias_ambiguous");
    if (reason === "similarity") return t("expenses.subscriptions.suggestions.reason_similarity");
    return t("expenses.subscriptions.suggestions.reason_amount_date");
  }

  return (
    <div className="section fade-in" style={{ marginBottom: "var(--space-4)" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("expenses.subscriptions.suggestions.section_title")}</b>
        </div>
      </div>
      <div className="section-body" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {visible.map((s) => {
          const key = pairKey(s);
          const isConfirming = confirming.has(key);
          return (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {/* Transaction side */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="mono"
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.transactionName}
                </div>
                <div className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginTop: 2 }}>
                  {s.transactionAmount} {s.transactionCurrencyCode} · {s.transactionDate}
                </div>
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
                }}
              >
                {reasonLabel(s.reason)}
              </span>

              {/* Confirm + count note */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ fontSize: "var(--text-xs)", padding: "4px 10px", whiteSpace: "nowrap" }}
                  disabled={isPending || isConfirming}
                  onClick={() => handleConfirm(s)}
                >
                  {isConfirming
                    ? "..."
                    : t("expenses.subscriptions.suggestions.confirm", {
                        vars: { name: s.subscriptionName },
                      })}
                </button>
                {s.count > 1 && (
                  <span
                    className="mono"
                    style={{ fontSize: "var(--text-xs)", color: "var(--dim)", whiteSpace: "nowrap" }}
                  >
                    {t("expenses.subscriptions.suggestions.count_more", { vars: { n: String(s.count - 1) } })}
                  </span>
                )}
              </div>

              {/* Dismiss */}
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: "var(--text-xs)", padding: "4px 8px", whiteSpace: "nowrap" }}
                disabled={isPending}
                onClick={() => handleDismiss(s)}
              >
                {t("expenses.subscriptions.suggestions.dismiss")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
