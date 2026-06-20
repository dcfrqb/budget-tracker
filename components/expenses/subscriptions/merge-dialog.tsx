"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { mergeSubscriptionsAction } from "@/app/(shell)/expenses/subscriptions/actions";
import { useT } from "@/lib/i18n";

export type MergeSubItem = {
  id: string;
  name: string;
  price: string;
  currencyCode: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subA: MergeSubItem;
  subB: MergeSubItem;
  onDone?: () => void;
};

export function MergeSubscriptionsDialog({ open, onOpenChange, subA, subB, onDone }: Props) {
  const t = useT();
  const router = useRouter();
  const [keepId, setKeepId] = useState<string>(subA.id);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    const mergeId = keepId === subA.id ? subB.id : subA.id;
    setError(null);
    startTransition(async () => {
      const result = await mergeSubscriptionsAction({ keepId, mergeId });
      if (result.ok) {
        onOpenChange(false);
        onDone?.();
        router.refresh();
      } else {
        setError(t("expenses.subscriptions.merge.error_generic"));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("expenses.subscriptions.merge.dialog_title")}
      size="sm"
      footer={
        <div className="submit-row-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t("forms.common.cancel")}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "..." : t("expenses.subscriptions.merge.confirm_button")}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <p className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>
          {t("expenses.subscriptions.merge.pick_keep_label")}
        </p>

        {[subA, subB].map((sub) => (
          <label
            key={sub.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              padding: "var(--space-2) var(--space-3)",
              border: `1px solid ${keepId === sub.id ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 3,
              cursor: "pointer",
              background: keepId === sub.id ? "var(--panel-2)" : "transparent",
            }}
          >
            <input
              type="radio"
              name="keep-sub"
              value={sub.id}
              checked={keepId === sub.id}
              onChange={() => setKeepId(sub.id)}
              disabled={isPending}
              style={{ accentColor: "var(--accent)" }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--text)" }}>
                {sub.name}
              </div>
              <div className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>
                {sub.price} {sub.currencyCode}
              </div>
            </div>
          </label>
        ))}

        <p className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--dim)" }}>
          {t("expenses.subscriptions.merge.warning_archived")}
        </p>

        {error && (
          <p className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--neg)" }}>
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
