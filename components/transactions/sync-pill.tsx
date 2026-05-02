"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useT, useLocale } from "@/lib/i18n";
import { syncAction } from "@/app/(shell)/wallet/integrations/actions";
import { formatRelative } from "@/lib/format/relative-time";
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
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const popoverRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);

  const hasCredentials = credentials.length > 0;
  const singleCred = credentials.length === 1 ? credentials[0] : null;

  const lastSyncDate = singleCred?.lastSyncAt
    ? new Date(singleCred.lastSyncAt)
    : null;

  const lastSyncAll = credentials.length > 0
    ? credentials.reduce<Date | null>((min, c) => {
        if (!c.lastSyncAt) return null;
        const d = new Date(c.lastSyncAt);
        if (min === null) return d;
        return d < min ? d : min;
      }, credentials[0].lastSyncAt ? new Date(credentials[0].lastSyncAt) : null)
    : null;

  const displayDate = singleCred ? lastSyncDate : lastSyncAll;

  const hasError = credentials.some((c) => {
    if (!c.lastErrorAt) return false;
    const errorAgo = Date.now() - new Date(c.lastErrorAt).getTime();
    return errorAgo < 24 * 60 * 60 * 1000;
  });

  function relLabel() {
    if (isPending) return t("transactions.sync.in_progress");
    if (hasError) return t("transactions.sync.error");
    if (!displayDate) return t("transactions.sync.never");
    const ago = formatRelative(displayDate, locale);
    return t("transactions.sync.last", { vars: { ago } });
  }

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
        pillRef.current &&
        !pillRef.current.contains(target)
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

  const handleSync = useCallback(
    (credId: string) => {
      setRowErrors((prev) => ({ ...prev, [credId]: "" }));
      startTransition(async () => {
        const result = await syncAction(credId);
        if (!result.ok) {
          const msg = t("transactions.sync.error");
          setRowErrors((prev) => ({ ...prev, [credId]: msg }));
          return;
        }
        setOpen(false);
        router.refresh();
      });
    },
    [t, router],
  );

  function handleClick() {
    if (!hasCredentials) return;
    if (singleCred) {
      handleSync(singleCred.id);
    } else {
      setOpen((v) => !v);
    }
  }

  const dotColor = isPending
    ? "var(--info)"
    : hasError
    ? "var(--neg)"
    : hasCredentials
    ? "var(--pos)"
    : "var(--dim)";

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        ref={pillRef}
        type="button"
        className="btn"
        disabled={!hasCredentials || isPending}
        onClick={handleClick}
        title={
          hasCredentials
            ? t("transactions.sync.button")
            : t("transactions.sync.no_credentials")
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
        <RefreshIcon spinning={isPending} />
        <span>{hasCredentials ? t("transactions.sync.button") : t("transactions.sync.no_credentials")}</span>
        <span
          style={{
            color: "var(--dim)",
            fontSize: "var(--text-xs)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {relLabel()}
        </span>
      </button>

      {open && credentials.length > 1 && (
        <div
          className="sync-popover"
          ref={popoverRef}
          role="dialog"
          aria-label={t("transactions.sync.button")}
        >
          <div className="sync-popover-inner">
            {credentials.map((cred) => {
              const syncDate = cred.lastSyncAt ? new Date(cred.lastSyncAt) : null;
              const relTime = syncDate ? formatRelative(syncDate, locale) : "—";
              const label = cred.displayLabel ?? cred.adapterId;
              const rowErr = rowErrors[cred.id];

              return (
                <div key={cred.id} className="sync-row">
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      minWidth: 0,
                    }}
                  >
                    <span
                      className="sync-row-name"
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </span>
                    {rowErr ? (
                      <span
                        className="sync-row-time"
                        style={{ color: "var(--neg)" }}
                      >
                        {rowErr}
                      </span>
                    ) : (
                      <span className="sync-row-time">{relTime}</span>
                    )}
                  </div>
                  <button
                    className="btn"
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      whiteSpace: "nowrap",
                    }}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleSync(cred.id)}
                  >
                    {t("transactions.sync.button")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
