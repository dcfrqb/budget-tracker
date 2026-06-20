"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { unlinkSubscriptionTransactionAction } from "@/app/(shell)/expenses/subscriptions/actions";

export type ChargeRow = {
  id: string;
  occurredAtFormatted: string;
  amount: string;
  currencyCode: string;
  accountName: string | null;
  subscriptionLinkSource: string | null;
  varianceLabel: string | null;
};

type Props = {
  charges: ChargeRow[];
};

export function PaymentHistory({ charges }: Props) {
  const t = useT();
  const router = useRouter();
  const [optimisticHidden, setOptimisticHidden] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  if (charges.length === 0) {
    return (
      <div className="mono" style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>
        {t("expenses.subscriptions.history.empty")}
      </div>
    );
  }

  const visible = charges.filter((c) => !optimisticHidden.has(c.id));

  function handleUnlink(chargeId: string, rollback: boolean) {
    setOptimisticHidden((prev) => new Set([...prev, chargeId]));
    startTransition(async () => {
      await unlinkSubscriptionTransactionAction({
        transactionId: chargeId,
        rollbackNextPaymentDate: rollback,
      });
      router.refresh();
    });
  }

  function sourceLabel(source: string | null): string {
    if (source === "auto") return t("expenses.subscriptions.history.source_auto");
    if (source === "manual") return t("expenses.subscriptions.history.source_manual");
    return t("expenses.subscriptions.history.source_cash");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {visible.map((charge, idx) => {
        const isLatest = idx === 0;
        return (
          <div
            key={charge.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span
              className="mono"
              style={{ fontSize: "var(--text-xs)", color: "var(--muted)", minWidth: 70 }}
            >
              {charge.occurredAtFormatted}
            </span>
            <span
              className="mono"
              style={{
                fontSize: "var(--text-md)",
                color: "var(--text)",
                fontVariantNumeric: "tabular-nums",
                minWidth: 80,
              }}
            >
              {charge.amount} {charge.currencyCode}
            </span>
            {charge.varianceLabel && (
              <span
                className="mono"
                style={{
                  fontSize: "var(--text-xs)",
                  color: charge.varianceLabel.startsWith("+") ? "var(--loss)" : "var(--gain)",
                }}
              >
                {charge.varianceLabel}
              </span>
            )}
            {charge.accountName && (
              <span
                className="mono"
                style={{ fontSize: "var(--text-xs)", color: "var(--muted)", flex: 1 }}
              >
                {charge.accountName}
              </span>
            )}
            <span
              className="mono"
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--muted)",
                background: "var(--panel-2)",
                border: "1px solid var(--border)",
                borderRadius: 3,
                padding: "1px 6px",
              }}
            >
              {sourceLabel(charge.subscriptionLinkSource)}
            </span>
            <button
              type="button"
              className="btn"
              disabled={isPending}
              style={{ fontSize: "var(--text-xs)", padding: "2px 8px" }}
              onClick={() => handleUnlink(charge.id, isLatest)}
            >
              {isLatest
                ? t("expenses.subscriptions.history.unlink_with_rollback")
                : t("expenses.subscriptions.history.unlink")}
            </button>
          </div>
        );
      })}
    </div>
  );
}
