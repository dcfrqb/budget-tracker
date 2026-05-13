"use client";

import { useState } from "react";
import { useT, useLocale } from "@/lib/i18n";
import { formatMoney } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";
import { linkTxnToFreelanceOrderAction } from "@/app/(shell)/income/actions";
import type { CandidateTxnForOrder } from "@/lib/data/work-sources";
import { Prisma } from "@prisma/client";

interface Props {
  orderId: string;
  workSourceId: string;
  currencyCode: string;
  candidates: CandidateTxnForOrder[];
  onLinked: () => void;
}

export function FreelanceOrderLinkPicker({ orderId, currencyCode, candidates, onLinked }: Props) {
  const t = useT();
  const locale = useLocale();
  const [pending, setPending] = useState<string | null>(null);

  async function handleLink(txnId: string) {
    setPending(txnId);
    await linkTxnToFreelanceOrderAction({ orderId, txnId });
    setPending(null);
    onLinked();
  }

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm, 2px)",
        padding: "var(--sp-2)",
        marginTop: "var(--sp-2)",
      }}
    >
      <div
        className="mono"
        style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginBottom: "var(--sp-2)" }}
      >
        {t("income.freelance_orders.link_picker.title")}
      </div>
      {candidates.length === 0 ? (
        <div className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>
          {t("income.freelance_orders.link_picker.empty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-1)" }}>
          {candidates.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-2)",
                fontSize: "var(--text-xs)",
              }}
            >
              <span className="mono" style={{ color: "var(--muted)", flexShrink: 0 }}>
                {formatDate(c.occurredAt, locale)}
              </span>
              <span
                className="mono"
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "var(--text)",
                }}
              >
                {c.name}
              </span>
              <span
                className="mono"
                style={{ color: "var(--pos)", flexShrink: 0 }}
              >
                {formatMoney(new Prisma.Decimal(c.amount), c.currencyCode)}
                {c.currencyCode !== currencyCode && (
                  <span style={{ color: "var(--muted)", marginLeft: "var(--sp-1)" }}>
                    ({c.currencyCode})
                  </span>
                )}
              </span>
              <button
                type="button"
                className="btn primary"
                style={{ padding: "var(--sp-1) var(--sp-2)", fontSize: "var(--text-xs)", flexShrink: 0 }}
                disabled={pending === c.id}
                onClick={() => handleLink(c.id)}
              >
                {t("income.freelance_orders.link_txn")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
