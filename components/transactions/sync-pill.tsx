"use client";

import { useT } from "@/lib/i18n";
import { useSyncAll, useSyncRelativeLabel } from "@/lib/hooks/use-sync-all";
import type { SyncCredentialProp } from "@/components/shell/sync-button";

type Props = {
  credentials: SyncCredentialProp[];
};

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      style={{
        display: "block",
        animation: spinning ? "sync-spin 1s linear infinite" : "none",
      }}
    >
      <path
        d="M13 2v4h-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.7 8.5A5 5 0 1 1 10.4 4.3L13 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SyncPill({ credentials }: Props) {
  const t = useT();
  const { trigger, state, lastSyncAt } = useSyncAll(credentials);
  const relLabel = useSyncRelativeLabel(lastSyncAt, state);

  const hasCredentials = credentials.length > 0;
  const isSyncing = state === "syncing";
  const isError = state === "error";

  const dotColor = isSyncing
    ? "var(--info)"
    : isError
    ? "var(--neg)"
    : hasCredentials
    ? "var(--pos)"
    : "var(--dim)";

  return (
    <button
      type="button"
      className="btn"
      disabled={!hasCredentials || isSyncing}
      onClick={hasCredentials ? trigger : undefined}
      title={
        hasCredentials
          ? t("transactions.sync.button")
          : t("transactions.sync.button_no_integrations")
      }
      style={{ gap: "var(--space-1)", display: "flex", alignItems: "center" }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: dotColor,
          flexShrink: 0,
        }}
        aria-hidden
      />
      <RefreshIcon spinning={isSyncing} />
      <span>
        {hasCredentials
          ? t("transactions.sync.button")
          : t("transactions.sync.button_no_integrations")}
      </span>
      <span
        style={{
          color: "var(--dim)",
          fontSize: "var(--text-xs)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {relLabel}
      </span>
    </button>
  );
}
