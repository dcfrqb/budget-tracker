"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { dismissDuplicatePairAction } from "@/app/(shell)/expenses/subscriptions/actions";
import { useSubscriptionSelection } from "./selection-context";
import { MergeSubscriptionsDialog, type MergeSubItem } from "./merge-dialog";

type Props = {
  subMap: Map<string, MergeSubItem>;
};

export function SubscriptionSelectionBar({ subMap }: Props) {
  const t = useT();
  const router = useRouter();
  const { selected, clear } = useSubscriptionSelection();
  const [mergeOpen, setMergeOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const count = selected.size;
  if (count === 0) return null;

  const selectedIds = Array.from(selected);
  const canActOnPair = count === 2;

  const subA = canActOnPair ? subMap.get(selectedIds[0]) : undefined;
  const subB = canActOnPair ? subMap.get(selectedIds[1]) : undefined;

  function handleDismiss() {
    if (!subA || !subB) return;
    startTransition(async () => {
      await dismissDuplicatePairAction({ idA: subA.id, idB: subB.id });
      clear();
      router.refresh();
    });
  }

  return (
    <>
      <div
        className="selection-action-bar"
        role="region"
        aria-label={t("expenses.subscriptions.merge.bar_label", { vars: { count: String(count) } })}
      >
        <span className="selection-count mono dim">
          {t("expenses.subscriptions.merge.selected_count", { vars: { count: String(count) } })}
        </span>

        <button
          type="button"
          className="btn-primary"
          disabled={!canActOnPair || isPending}
          title={canActOnPair ? "" : t("expenses.subscriptions.merge.need_two_hint")}
          onClick={() => setMergeOpen(true)}
        >
          {t("expenses.subscriptions.merge.action_merge")}
        </button>

        <button
          type="button"
          className="btn"
          disabled={!canActOnPair || isPending}
          title={canActOnPair ? "" : t("expenses.subscriptions.merge.need_two_hint")}
          onClick={handleDismiss}
        >
          {t("expenses.subscriptions.merge.action_not_duplicate")}
        </button>

        <button
          type="button"
          className="btn"
          onClick={clear}
          disabled={isPending}
        >
          {t("expenses.subscriptions.merge.clear_selection")}
        </button>
      </div>

      {mergeOpen && subA && subB && (
        <MergeSubscriptionsDialog
          open={mergeOpen}
          onOpenChange={setMergeOpen}
          subA={subA}
          subB={subB}
          onDone={clear}
        />
      )}
    </>
  );
}
