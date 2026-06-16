"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFreelanceOrderAction } from "@/app/(shell)/income/actions";

interface Props {
  orderId: string;
  workSourceId: string;
  deleteLabel: string;
  deleteConfirm: string;
}

export function OrderDetailActions({ orderId, workSourceId, deleteLabel, deleteConfirm }: Props) {
  const router = useRouter();
  const [isPending, start] = useTransition();

  function handleDelete() {
    if (!confirm(deleteConfirm)) return;
    start(async () => {
      const result = await deleteFreelanceOrderAction(orderId);
      if (result.ok) {
        router.push(`/income/work-sources/${workSourceId}`);
      }
    });
  }

  return (
    <button
      type="button"
      className="btn-ghost"
      disabled={isPending}
      onClick={handleDelete}
      style={{ fontSize: "var(--text-xs)", color: "var(--neg)" }}
    >
      {deleteLabel}
    </button>
  );
}
