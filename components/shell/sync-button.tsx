"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { syncAction } from "@/app/(shell)/wallet/integrations/actions";
import { formatRelative } from "@/lib/format/relative-time";
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
// Determine button visual state from all credentials
// ─────────────────────────────────────────────────────────────

type SyncState = "idle" | "syncing" | "stale" | "error";

function deriveState(
  credentials: SyncCredentialProp[],
  isSyncing: boolean,
): { state: SyncState; hasError: boolean } {
  if (isSyncing) return { state: "syncing", hasError: false };
  if (credentials.length === 0) return { state: "idle", hasError: false };

  const now = Date.now();
  const H12 = 12 * 60 * 60 * 1000;
  const H24 = 24 * 60 * 60 * 1000;

  let hasError = false;
  let isStale = false;

  for (const c of credentials) {
    if (c.lastErrorAt) {
      const errorAgo = now - new Date(c.lastErrorAt).getTime();
      if (errorAgo < H24) hasError = true;
    }
    if (c.lastSyncAt) {
      const syncAgo = now - new Date(c.lastSyncAt).getTime();
      if (syncAgo > H12) isStale = true;
    } else {
      isStale = true;
    }
  }

  if (hasError) return { state: "error", hasError: true };
  if (isStale) return { state: "stale", hasError: false };
  return { state: "idle", hasError: false };
}

// ─────────────────────────────────────────────────────────────
// Refresh SVG icon (circular arrow)
// ─────────────────────────────────────────────────────────────

function RefreshIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      style={{ display: "block" }}
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

export function SyncButton({ credentials, locale }: Props) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const popoverRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const { state, hasError } = deriveState(credentials, isPending);

  // Close popover on outside click / Escape
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        btnRef.current &&
        !btnRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const handleSyncRow = useCallback(
    (credId: string) => {
      setRowErrors((prev) => ({ ...prev, [credId]: "" }));
      startTransition(async () => {
        const result = await syncAction(credId);
        if (!result.ok) {
          const msg =
            result.error === "busy"
              ? t("shell.sync.busy")
              : t("shell.sync.error");
          setRowErrors((prev) => ({ ...prev, [credId]: msg }));
          return;
        }
        setOpen(false);
        router.refresh();
      });
    },
    [t, router],
  );

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        ref={btnRef}
        className="sync-btn"
        data-state={state}
        title={t("shell.sync.tooltip")}
        aria-label={t("shell.sync.tooltip")}
        onClick={() => setOpen((v) => !v)}
      >
        <RefreshIcon />
        {hasError && <span className="sync-error-dot" aria-hidden />}
      </button>

      {open && (
        <div className="sync-popover" ref={popoverRef} role="dialog" aria-label={t("shell.sync.tooltip")}>
          <div className="sync-popover-inner">
            {credentials.length === 0 ? (
              <div className="sync-row-empty">
                <a href="/wallet/integrations" style={{ color: "var(--info)", textDecoration: "none" }}>
                  {t("shell.sync.empty")}
                </a>
              </div>
            ) : (
              credentials.map((cred) => {
                const lastSyncDate = cred.lastSyncAt ? new Date(cred.lastSyncAt) : null;
                const relTime = lastSyncDate
                  ? formatRelative(lastSyncDate, locale)
                  : "—";
                const label = cred.displayLabel ?? cred.adapterId;
                const rowErr = rowErrors[cred.id];

                return (
                  <div key={cred.id} className="sync-row">
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                      <span className="sync-row-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {label}
                      </span>
                      {rowErr ? (
                        <span className="sync-row-time" style={{ color: "var(--neg)" }}>{rowErr}</span>
                      ) : (
                        <span className="sync-row-time">{relTime}</span>
                      )}
                    </div>
                    <button
                      className="btn"
                      style={{ fontSize: 10, padding: "2px 8px", whiteSpace: "nowrap" }}
                      type="button"
                      disabled={isPending}
                      onClick={() => handleSyncRow(cred.id)}
                    >
                      {t("settings.integrations.action.sync")}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
