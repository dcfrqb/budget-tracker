"use client";

import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n";
import type { BankAdapterMeta } from "@/lib/integrations/types";
import {
  connectAdapterAction,
  loginAction,
} from "@/app/(shell)/wallet/integrations/actions";

type Props = {
  adapter: BankAdapterMeta;
  onClose: () => void;
  onDone: () => void;
};

export function BybitCardConnectForm({ adapter, onClose, onDone }: Props) {
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const [displayLabel, setDisplayLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function mapBybitError(code: string | null | undefined): string {
    if (!code) return t("settings.integrations.bybit_card.error.unknown");
    const head = code.split(":")[0].trim().toUpperCase();
    if (head === "INVALID_KEY" || head === "INVALID_CREDENTIALS" || head === "INVALID_SIGNATURE") {
      return t("settings.integrations.bybit_card.error.invalid_key");
    }
    if (head === "NETWORK_ERROR") {
      return t("settings.integrations.bybit_card.error.network");
    }
    if (head === "RATE_LIMITED" || head === "RATE_LIMIT") {
      return t("settings.integrations.bybit_card.error.rate_limit");
    }
    return t("settings.integrations.bybit_card.error.unknown");
  }

  function handleSubmit() {
    setErrorMsg(null);
    startTransition(async () => {
      const input: Record<string, string> = {
        displayLabel,
        username: apiKey,
        password: apiSecret,
      };

      let result = await connectAdapterAction(adapter.id, input);

      if (result.ok && adapter.supports.login) {
        const created = result.data as { id?: string } | undefined;
        if (created?.id) {
          result = await loginAction(created.id, {
            username: apiKey,
            password: apiSecret,
          });
        }
      }

      if (!result.ok) {
        setErrorMsg(mapBybitError(result.error));
        return;
      }
      onDone();
    });
  }

  const canSubmit = apiKey.trim().length > 0 && apiSecret.trim().length > 0 && !isPending;

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
          maxWidth: 420,
          width: "90%",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Title */}
        <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
          {t("settings.integrations.action.connect")} — {t("settings.integrations.bybit_card.title")}
        </div>

        {/* Subtitle / helper */}
        <div className="mono" style={{ fontSize: 10, color: "var(--dim)" }}>
          {t("settings.integrations.bybit_card.helper")}
        </div>

        {/* Display label */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
            {t("settings.integrations.form.display_label")}
          </label>
          <input
            className="settings-input"
            value={displayLabel}
            onChange={(e) => setDisplayLabel(e.target.value)}
            placeholder={t("settings.integrations.bybit_card.title")}
          />
        </div>

        {/* API Key */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
            {t("settings.integrations.bybit_card.api_key_label")}
          </label>
          <input
            className="settings-input mono"
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* API Secret */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
              {t("settings.integrations.bybit_card.api_secret_label")}
            </label>
            <button
              type="button"
              className="btn"
              style={{ fontSize: 10, padding: "2px 8px" }}
              onClick={() => setShowSecret((v) => !v)}
              tabIndex={-1}
            >
              {showSecret
                ? t("settings.integrations.bybit_card.hide_secret")
                : t("settings.integrations.bybit_card.show_secret")}
            </button>
          </div>
          <input
            className="settings-input mono"
            type={showSecret ? "text" : "password"}
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="sig warn">
            <div className="m mono" style={{ fontSize: 11 }}>{errorMsg}</div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn" type="button" onClick={onClose} disabled={isPending}>
            {t("common.close")}
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isPending
              ? t("settings.integrations.bybit_card.connecting")
              : t("settings.integrations.bybit_card.test_connect_cta")}
          </button>
        </div>
      </div>
    </div>
  );
}
