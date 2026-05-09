"use client";

import { useTransition } from "react";
import { useT } from "@/lib/i18n/context";
import {
  deactivateWorkSourceAction,
  activateWorkSourceAction,
} from "@/app/(shell)/income/actions";

interface Props {
  sourceId: string;
  isActive: boolean;
}

export function DetailActions({ sourceId, isActive }: Props) {
  const t = useT();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      if (isActive) {
        await deactivateWorkSourceAction(sourceId);
      } else {
        await activateWorkSourceAction(sourceId);
      }
    });
  }

  return (
    <button
      className="btn"
      onClick={handleToggle}
      disabled={isPending}
      style={{ fontSize: "var(--text-xs)", padding: "4px 12px", opacity: isPending ? 0.6 : 1 }}
    >
      {isActive
        ? t("income.work.detail.deactivate")
        : t("income.work.detail.activate")}
    </button>
  );
}
