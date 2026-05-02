"use client";

import { useT } from "@/lib/i18n";
import { useSyncAll, useSyncRelativeLabel } from "@/lib/hooks/use-sync-all";
import type { Locale } from "@/lib/i18n/types";

// ─────────────────────────────────────────────────────────────
// Props — serialized credential info passed from server component
// ─────────────────────────────────────────────────────────────

export type SyncCredentialProp = {
  id: string;
  displayLabel: string | null;
  adapterId: string;
  lastSyncAt: string | null;
  lastErrorAt: string | null;
};

type Props = {
  credentials: SyncCredentialProp[];
  locale: Locale;
};

// ─────────────────────────────────────────────────────────────
// Refresh SVG icon (circular arrow)
// ─────────────────────────────────────────────────────────────

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="12"
      height="12"
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

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export function SyncButton({ credentials }: Props) {
  const t = useT();
  const { trigger, state, lastSyncAt } = useSyncAll(credentials);
  const relLabel = useSyncRelativeLabel(lastSyncAt, state);

  const isSyncing = state === "syncing";
  const isError = state === "error";

  const hasCredentials = credentials.length > 0;

  return (
    <button
      className="sync-btn"
      data-state={isSyncing ? "syncing" : isError ? "error" : "idle"}
      title={hasCredentials ? t("shell.sync.tooltip") : t("shell.sync.empty")}
      aria-label={hasCredentials ? t("shell.sync.tooltip") : t("shell.sync.empty")}
      onClick={hasCredentials ? trigger : undefined}
      disabled={isSyncing || !hasCredentials}
    >
      <RefreshIcon spinning={isSyncing} />
      {isError && <span className="sync-error-dot" aria-hidden />}
      <span
        className="mono"
        style={{ fontSize: 9, color: "var(--dim)", lineHeight: 1 }}
      >
        {relLabel}
      </span>
    </button>
  );
}
