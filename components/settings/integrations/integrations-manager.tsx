"use client";

import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n";
import type { BankAdapter } from "@/lib/integrations/types";
import type { IntegrationStatus } from "@prisma/client";
import {
  connectAdapterAction,
  loginAction,
  submitOtpAction,
  syncAction,
  disconnectAction,
  deleteCredentialAction,
} from "@/app/(shell)/settings/integrations/actions";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type CredentialRow = {
  id: string;
  adapterId: string;
  displayLabel: string | null;
  status: IntegrationStatus;
  lastSyncAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
};

type Props = {
  adapters: BankAdapter[];
  credentials: CredentialRow[];
};

// ─────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const t = useT();
  const statusMap: Record<IntegrationStatus, { key: string; color: string }> = {
    DISCONNECTED: { key: "settings.integrations.status.disconnected", color: "var(--dim)" },
    CONNECTED: { key: "settings.integrations.status.connected", color: "var(--pos)" },
    NEEDS_OTP: { key: "settings.integrations.status.needs_otp", color: "var(--warn)" },
    ERROR: { key: "settings.integrations.status.error", color: "var(--neg)" },
  };
  const { key, color } = statusMap[status] ?? statusMap.DISCONNECTED;
  return (
    <span
      className="mono"
      style={{
        fontSize: 10,
        color,
        border: `1px solid ${color}`,
        borderRadius: 2,
        padding: "2px 6px",
        opacity: 0.85,
      }}
    >
      {t(key as Parameters<typeof t>[0])}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Connect dialog (for adapters that need initial input)
// ─────────────────────────────────────────────────────────────

function ConnectDialog({
  adapter,
  onClose,
  onDone,
}: {
  adapter: BankAdapter;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const [displayLabel, setDisplayLabel] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleSubmit() {
    setErrorMsg(null);
    startTransition(async () => {
      const input: Record<string, string> = { displayLabel };
      if (adapter.supports.login) {
        input.username = username;
        input.password = password;
      }
      const result = await connectAdapterAction(adapter.id, input);
      if (!result.ok) {
        setErrorMsg(result.error);
        return;
      }
      onDone();
    });
  }

  const usernameLabel =
    adapter.category === "email-forward"
      ? t("settings.integrations.form.email_forward")
      : t("settings.integrations.form.username");

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
        background: "rgba(0,0,0,0.7)",
      }}
    >
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 24,
          maxWidth: 400,
          width: "90%",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
          {t("settings.integrations.action.connect")} — {adapter.displayName.startsWith("settings.")
            ? t(adapter.displayName as Parameters<typeof t>[0])
            : adapter.displayName}
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
            placeholder={adapter.displayName.startsWith("settings.")
              ? t(adapter.displayName as Parameters<typeof t>[0])
              : adapter.displayName}
          />
        </div>

        {/* Username/email field (only for adapters requiring login) */}
        {adapter.supports.login && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                {usernameLabel}
              </label>
              <input
                className="settings-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            {adapter.category !== "email-forward" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                  {t("settings.integrations.form.password")}
                </label>
                <input
                  className="settings-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            )}
          </>
        )}

        {errorMsg && (
          <div className="sig warn">
            <div className="m mono" style={{ fontSize: 11 }}>{errorMsg}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn" type="button" onClick={onClose} disabled={isPending}>
            {t("common.close")}
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? "..." : t("settings.integrations.action.connect")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// OTP dialog
// ─────────────────────────────────────────────────────────────

function OtpDialog({
  credentialId,
  onClose,
  onDone,
}: {
  credentialId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleSubmit() {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await submitOtpAction(credentialId, { code });
      if (!result.ok) {
        setErrorMsg(result.error);
        return;
      }
      onDone();
    });
  }

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
        background: "rgba(0,0,0,0.7)",
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
        <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
          {t("settings.integrations.action.submit_otp")}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
            {t("settings.integrations.form.otp_code")}
          </label>
          <input
            className="settings-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={8}
          />
        </div>

        {errorMsg && (
          <div className="sig warn">
            <div className="m mono" style={{ fontSize: 11 }}>{errorMsg}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn" type="button" onClick={onClose} disabled={isPending}>
            {t("common.close")}
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={handleSubmit}
            disabled={isPending || code.length === 0}
          >
            {isPending ? "..." : t("settings.integrations.action.submit_otp")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Credential card
// ─────────────────────────────────────────────────────────────

function CredentialCard({
  cred,
  adapter,
  onRefresh,
}: {
  cred: CredentialRow;
  adapter: BankAdapter | null;
  onRefresh: () => void;
}) {
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const label = cred.displayLabel ?? cred.adapterId;
  const canSync =
    cred.status === "CONNECTED" && adapter?.supports.fetchTransactions;
  const canOtp = cred.status === "NEEDS_OTP" && adapter?.supports.otp;
  const canLogin =
    (cred.status === "ERROR" || cred.status === "DISCONNECTED") &&
    adapter?.supports.login;

  function doSync() {
    setFeedback(null);
    startTransition(async () => {
      const result = await syncAction(cred.id);
      if (!result.ok) {
        setFeedback(result.error);
      } else {
        const data = result.data as { created: number; skipped: number } | undefined;
        setFeedback(
          data
            ? `+${data.created} / skip ${data.skipped}`
            : "ok",
        );
      }
      onRefresh();
    });
  }

  function doDisconnect() {
    startTransition(async () => {
      await disconnectAction(cred.id);
      onRefresh();
    });
  }

  function doDelete() {
    startTransition(async () => {
      await deleteCredentialAction(cred.id);
      onRefresh();
    });
  }

  return (
    <>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 3,
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          background: "var(--panel-2)",
        }}
      >
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="mono" style={{ fontSize: 12, color: "var(--text)", fontWeight: 600 }}>
            {label}
          </span>
          <StatusBadge status={cred.status} />
          {adapter && (
            <span className="mono" style={{ fontSize: 10, color: "var(--dim)" }}>
              {t(`settings.integrations.category.${adapter.category === "api-reverse" ? "api_reverse" : adapter.category === "email-forward" ? "email" : "csv"}` as Parameters<typeof t>[0])}
            </span>
          )}
        </div>

        {/* Error message */}
        {cred.status === "ERROR" && cred.lastErrorMessage && (
          <div className="mono" style={{ fontSize: 10, color: "var(--neg)", opacity: 0.8 }}>
            {cred.lastErrorMessage}
          </div>
        )}

        {/* Last sync */}
        {cred.lastSyncAt && (
          <div className="mono" style={{ fontSize: 10, color: "var(--dim)" }}>
            sync: {new Date(cred.lastSyncAt).toLocaleString()}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className="mono" style={{ fontSize: 10, color: "var(--info)" }}>
            {feedback}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          {canSync && (
            <button className="btn" type="button" onClick={doSync} disabled={isPending}>
              {t("settings.integrations.action.sync")}
            </button>
          )}
          {canOtp && (
            <button
              className="btn primary"
              type="button"
              onClick={() => setShowOtpDialog(true)}
              disabled={isPending}
            >
              {t("settings.integrations.action.submit_otp")}
            </button>
          )}
          {canLogin && (
            <button
              className="btn"
              type="button"
              onClick={() => {
                // For re-login, we'd need to show a login dialog.
                // For now, guide user to delete + reconnect.
                setFeedback("Please delete and reconnect to re-authenticate.");
              }}
              disabled={isPending}
            >
              {t("settings.integrations.action.login")}
            </button>
          )}
          <button className="btn" type="button" onClick={doDisconnect} disabled={isPending}>
            {t("settings.integrations.action.disconnect")}
          </button>
          <button
            className="btn"
            type="button"
            onClick={doDelete}
            disabled={isPending}
            style={{ color: "var(--neg)", borderColor: "rgba(248,81,73,.35)" }}
          >
            {t("settings.integrations.action.delete")}
          </button>
        </div>
      </div>

      {showOtpDialog && (
        <OtpDialog
          credentialId={cred.id}
          onClose={() => setShowOtpDialog(false)}
          onDone={() => {
            setShowOtpDialog(false);
            onRefresh();
          }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Main manager
// ─────────────────────────────────────────────────────────────

export function IntegrationsManager({ adapters, credentials: initialCredentials }: Props) {
  const t = useT();
  const [credentials, setCredentials] = useState<CredentialRow[]>(initialCredentials);
  const [connectingAdapter, setConnectingAdapter] = useState<BankAdapter | null>(null);

  // After any mutation the server action calls revalidatePath — but since we're
  // a client component we trigger a soft refresh by updating local state.
  // Full server revalidation happens on next navigation.
  function refresh() {
    // Trigger a full page refresh to get updated data from server
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  const adapterById = new Map(adapters.map((a) => [a.id, a]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Warning banner */}
      <div
        className="sig warn"
        style={{ padding: "10px 14px" }}
      >
        <div className="k mono" style={{ fontSize: 10 }}>
          {t("settings.integrations.warning_title")}
        </div>
        <div className="m mono" style={{ fontSize: 11 }}>
          {t("settings.integrations.warning_body")}
        </div>
      </div>

      {/* Available adapters */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="settings-section-title mono">
          {t("settings.integrations.available")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {adapters.map((adapter) => {
            const catKey = adapter.category === "api-reverse"
              ? "settings.integrations.category.api_reverse"
              : adapter.category === "email-forward"
              ? "settings.integrations.category.email"
              : "settings.integrations.category.csv";
            const displayName = adapter.displayName.startsWith("settings.")
              ? t(adapter.displayName as Parameters<typeof t>[0])
              : adapter.displayName;

            return (
              <div
                key={adapter.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 3,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  background: "var(--panel-2)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="mono" style={{ fontSize: 12, color: "var(--text)", fontWeight: 600 }}>
                    {displayName}
                  </span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--dim)" }}>
                    {t(catKey as Parameters<typeof t>[0])}
                  </span>
                </div>
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => setConnectingAdapter(adapter)}
                >
                  {t("settings.integrations.action.connect")}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connected credentials */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="settings-section-title mono">
          {t("settings.integrations.connected")}
        </div>
        {credentials.length === 0 ? (
          <div className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>
            {t("settings.integrations.no_credentials")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {credentials.map((cred) => (
              <CredentialCard
                key={cred.id}
                cred={cred}
                adapter={adapterById.get(cred.adapterId) ?? null}
                onRefresh={refresh}
              />
            ))}
          </div>
        )}
      </div>

      {/* Connect dialog */}
      {connectingAdapter && (
        <ConnectDialog
          adapter={connectingAdapter}
          onClose={() => setConnectingAdapter(null)}
          onDone={() => {
            setConnectingAdapter(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
