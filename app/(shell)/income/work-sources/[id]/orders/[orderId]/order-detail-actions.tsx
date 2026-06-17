"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { deleteFreelanceOrderAction } from "@/app/(shell)/income/actions";

interface Props {
  orderId: string;
  workSourceId: string;
  deleteLabel: string;
  deleteConfirmTitle: string;
  deleteConfirmBody: string;
  cancelLabel: string;
}

export function OrderDetailActions({
  orderId,
  workSourceId,
  deleteLabel,
  deleteConfirmTitle,
  deleteConfirmBody,
  cancelLabel,
}: Props) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [open, setOpen] = useState(false);

  function handleConfirmDelete() {
    setOpen(false);
    start(async () => {
      const result = await deleteFreelanceOrderAction(orderId);
      if (result.ok) {
        router.push(`/income/work-sources/${workSourceId}`);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className="btn-ghost"
        disabled={isPending}
        onClick={() => setOpen(true)}
        style={{ fontSize: "var(--text-xs)", color: "var(--neg)" }}
      >
        {deleteLabel}
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={deleteConfirmTitle}
        size="sm"
        footer={
          <div style={{ display: "flex", gap: "var(--sp-2)", width: "100%" }}>
            <button
              type="button"
              className="btn"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className="btn"
              style={{ marginLeft: "auto", color: "var(--neg)", borderColor: "var(--neg)" }}
              onClick={handleConfirmDelete}
              disabled={isPending}
            >
              {deleteLabel}
            </button>
          </div>
        }
      >
        <p
          className="mono"
          style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: 0 }}
        >
          {deleteConfirmBody}
        </p>
      </Dialog>
    </>
  );
}
