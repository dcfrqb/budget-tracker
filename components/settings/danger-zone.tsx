"use client";

import { useT } from "@/lib/i18n";
import { useState, useTransition } from "react";
import { wipeAllDataAction } from "@/app/(shell)/settings/actions";

export function DangerZone() {
  const t = useT();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const confirmPhrase = t("settings.danger.confirm_phrase");

  function openDialog() {
    setDialogOpen(true);
    setPhrase("");
    setError(null);
  }

  function closeDialog() {
    setDialogOpen(false);
    setPhrase("");
    setError(null);
  }

  function handleWipe() {
    if (phrase !== confirmPhrase) return;
    setError(null);
    startTransition(async () => {
      const result = await wipeAllDataAction();
      if (result?.error) {
        setError(t("settings.danger.error_wipe"));
      }
      // On success the action redirects to "/" so no further handling needed here
    });
  }

  return (
    <div className="settings-section settings-danger">
      <div className="settings-section-title mono">
        {t("settings.danger.section_title")}
      </div>
      <button
        type="button"
        className="settings-danger-btn mono"
        onClick={openDialog}
      >
        {t("settings.danger.wipe_button")}
      </button>

      {dialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("settings.danger.dialog_title")}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.7)",
          }}
        >
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: 24,
              maxWidth: 440,
              width: "90%",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--neg)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {t("settings.danger.dialog_title")}
            </div>

            <div
              className="mono"
              style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}
            >
              {t("settings.danger.dialog_body")}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label
                htmlFor="wipe-confirm"
                className="mono"
                style={{ fontSize: 11, color: "var(--dim)" }}
              >
                {t("settings.danger.confirm_label", { vars: { phrase: confirmPhrase } })}
              </label>
              <input
                id="wipe-confirm"
                type="text"
                className="settings-input mono"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </div>

            {error && (
              <span className="mono" style={{ fontSize: 11, color: "var(--neg)" }}>
                {error}
              </span>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn"
                onClick={closeDialog}
                disabled={isPending}
              >
                {t("settings.danger.cancel_button")}
              </button>
              <button
                type="button"
                className="settings-danger-btn mono"
                onClick={handleWipe}
                disabled={phrase !== confirmPhrase || isPending}
                style={{ opacity: phrase !== confirmPhrase ? 0.4 : 1 }}
              >
                {t("settings.danger.confirm_button")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
