"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { dismissSignalAction } from "@/app/(shell)/actions";

export function SignalDismiss({
  signalKey,
  dismissLabel,
}: {
  signalKey: string;
  dismissLabel: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      await dismissSignalAction({ signalKey });
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={dismissLabel}
      style={{
        position: "absolute",
        top: "var(--space-1)",
        right: "var(--space-1)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "2px 4px",
        lineHeight: 1,
        fontSize: "var(--text-xs)",
        color: "var(--muted)",
        opacity: isPending ? 0.4 : 0.6,
        transition: "opacity 120ms ease, color 120ms ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = "1";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = isPending ? "0.4" : "0.6";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)";
      }}
    >
      ×
    </button>
  );
}
