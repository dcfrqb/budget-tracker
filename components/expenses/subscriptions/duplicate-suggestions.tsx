"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { dismissDuplicatePairAction } from "@/app/(shell)/expenses/subscriptions/actions";
import { MergeSubscriptionsDialog, type MergeSubItem } from "./merge-dialog";

export type DuplicatePairRow = {
  a: MergeSubItem;
  b: MergeSubItem;
};

type Props = {
  pairs: DuplicatePairRow[];
};

export function DuplicateSuggestions({ pairs }: Props) {
  const t = useT();
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [mergeDialog, setMergeDialog] = useState<{ subA: MergeSubItem; subB: MergeSubItem } | null>(null);

  function pairKey(a: MergeSubItem, b: MergeSubItem) {
    return `${a.id}:${b.id}`;
  }

  const visible = pairs.filter((p) => !dismissed.has(pairKey(p.a, p.b)));

  if (visible.length === 0) return null;

  function handleDismiss(a: MergeSubItem, b: MergeSubItem) {
    const key = pairKey(a, b);
    startTransition(async () => {
      await dismissDuplicatePairAction({ idA: a.id, idB: b.id });
      setDismissed((prev) => new Set([...prev, key]));
      router.refresh();
    });
  }

  return (
    <>
      <div className="section fade-in" style={{ marginBottom: "var(--space-4)" }}>
        <div className="section-hd">
          <div className="ttl mono">
            <span className="dim">{t("expenses.subscriptions.duplicates.section_title")}</span>
          </div>
        </div>
        <div className="section-body" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {visible.map((pair) => {
            const key = pairKey(pair.a, pair.b);
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
                {/* Sub A */}
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
                    {pair.a.name}
                  </div>
                  <div className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginTop: 2 }}>
                    {pair.a.price} {pair.a.currencyCode}
                  </div>
                </div>

                {/* Separator */}
                <span className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--dim)" }}>
                  ≈
                </span>

                {/* Sub B */}
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
                    {pair.b.name}
                  </div>
                  <div className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--muted)", marginTop: 2 }}>
                    {pair.b.price} {pair.b.currencyCode}
                  </div>
                </div>

                {/* Merge inline */}
                <button
                  type="button"
                  className="btn-primary"
                  style={{ fontSize: "var(--text-xs)", padding: "4px 10px", whiteSpace: "nowrap" }}
                  disabled={isPending}
                  onClick={() => setMergeDialog({ subA: pair.a, subB: pair.b })}
                >
                  {t("expenses.subscriptions.duplicates.action_merge")}
                </button>

                {/* Dismiss inline */}
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: "var(--text-xs)", padding: "4px 8px", whiteSpace: "nowrap" }}
                  disabled={isPending}
                  onClick={() => handleDismiss(pair.a, pair.b)}
                >
                  {t("expenses.subscriptions.duplicates.action_dismiss")}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {mergeDialog && (
        <MergeSubscriptionsDialog
          open={true}
          onOpenChange={(open) => { if (!open) setMergeDialog(null); }}
          subA={mergeDialog.subA}
          subB={mergeDialog.subB}
          onDone={() => {
            const key = pairKey(mergeDialog.subA, mergeDialog.subB);
            setDismissed((prev) => new Set([...prev, key]));
            setMergeDialog(null);
          }}
        />
      )}
    </>
  );
}
