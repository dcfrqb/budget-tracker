"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

type Props = {
  open: boolean;
  result: {
    created: number;
    updated: number;
    skipped: number;
    errorClass: string | null;
  } | null;
  onClose: () => void;
};

export function SyncCompletionDialog({ open, result, onClose }: Props) {
  const t = useT();

  if (!open || result === null) return null;

  const hasError = result.errorClass !== null;
  const titleColor = hasError ? "var(--neg)" : "var(--pos)";
  const titleKey = hasError
    ? "settings.integrations.sync.completion.title_error"
    : "settings.integrations.sync.completion.title_ok";

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--overlay-strong)",
      }}
    >
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 24,
          maxWidth: 360,
          width: "90%",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          className="mono"
          style={{ fontSize: 12, fontWeight: 700, color: titleColor }}
        >
          {t(titleKey)}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--text)" }}>
            {t("settings.integrations.sync.completion.created", {
              vars: { count: String(result.created) },
            })}
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--text)" }}>
            {t("settings.integrations.sync.completion.updated", {
              vars: { count: String(result.updated) },
            })}
          </div>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: result.errorClass !== null ? "var(--neg)" : "var(--dim)",
            }}
          >
            {t("settings.integrations.sync.completion.errors", {
              vars: { count: String(hasError ? 1 : 0) },
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn" type="button" onClick={onClose}>
            {t("settings.integrations.sync.completion.close")}
          </button>
          <Link
            href="/transactions"
            className="btn primary"
            onClick={onClose}
            style={{ textDecoration: "none" }}
          >
            {t("settings.integrations.sync.completion.go_transactions")}
          </Link>
        </div>
      </div>
    </div>
  );
}
