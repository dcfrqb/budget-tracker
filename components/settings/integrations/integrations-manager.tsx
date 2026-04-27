"use client";

import { useState, useEffect, useTransition } from "react";
import { useT } from "@/lib/i18n";
import type { BankAdapterMeta } from "@/lib/integrations/types";
import type { IntegrationStatus } from "@prisma/client";
import { InfoCallout } from "@/components/ui/info-callout";
import {
  connectAdapterAction,
  loginAction,
  reloginAction,
  submitOtpAction,
  syncAction,
  disconnectAction,
  deleteCredentialAction,
  listAccountLinksAction,
} from "@/app/(shell)/settings/integrations/actions";
import { LinkAccountsDialog } from "./link-accounts-dialog";

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
  adapters: BankAdapterMeta[];
  credentials: CredentialRow[];
};

// ─────────────────────────────────────────────────────────────
// Error code → i18n key mapping helper
// ─────────────────────────────────────────────────────────────

type TinkoffErrorKey =
  | "settings.integrations.tinkoff_retail.error.insufficient_privileges"
  | "settings.integrations.tinkoff_retail.error.invalid_credentials"
  | "settings.integrations.tinkoff_retail.error.rate_limited"
  | "settings.integrations.tinkoff_retail.error.unknown"
  | "settings.integrations.tinkoff_retail.error.invalid_pin"
  | "settings.integrations.tinkoff_retail.error.invalid_phone"
  | "settings.integrations.tinkoff_retail.error.captcha_required"
  | "settings.integrations.tinkoff_retail.error.session_expired"
  | "settings.integrations.tinkoff_retail.error.sms_timeout"
  | "settings.integrations.tinkoff_retail.error.no_session"
  | "settings.integrations.tinkoff_retail.error.no_pending_sms"
  | "settings.integrations.tinkoff_retail.error.login_failed"
  | "settings.integrations.tinkoff_retail.error.unknown_step";

function mapAdapterError(code: string): TinkoffErrorKey {
  const map: Record<string, TinkoffErrorKey> = {
    INSUFFICIENT_PRIVILEGES: "settings.integrations.tinkoff_retail.error.insufficient_privileges",
    INVALID_CREDENTIALS: "settings.integrations.tinkoff_retail.error.invalid_credentials",
    RATE_LIMITED: "settings.integrations.tinkoff_retail.error.rate_limited",
    INVALID_PIN: "settings.integrations.tinkoff_retail.error.invalid_pin",
    INVALID_PHONE: "settings.integrations.tinkoff_retail.error.invalid_phone",
    CAPTCHA_REQUIRED: "settings.integrations.tinkoff_retail.error.captcha_required",
    SESSION_EXPIRED: "settings.integrations.tinkoff_retail.error.session_expired",
    SMS_TIMEOUT: "settings.integrations.tinkoff_retail.error.sms_timeout",
    NO_SESSION: "settings.integrations.tinkoff_retail.error.no_session",
    NO_PENDING_SMS: "settings.integrations.tinkoff_retail.error.no_pending_sms",
    LOGIN_FAILED: "settings.integrations.tinkoff_retail.error.login_failed",
    UNKNOWN_STEP: "settings.integrations.tinkoff_retail.error.unknown_step",
  };
  return map[code.toUpperCase()] ?? "settings.integrations.tinkoff_retail.error.unknown";
}

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
// Connect / Relogin dialog
// ─────────────────────────────────────────────────────────────

function ConnectDialog({
  adapter,
  existingCredentialId,
  onClose,
  onDone,
}: {
  adapter: BankAdapterMeta;
  existingCredentialId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const [displayLabel, setDisplayLabel] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isRelogin = Boolean(existingCredentialId);

  function handleSubmit() {
    setErrorMsg(null);
    startTransition(async () => {
      let result;
      if (isRelogin && existingCredentialId) {
        result = await reloginAction({
          credentialId: existingCredentialId,
          phone: username,
          password,
        });
      } else {
        const input: Record<string, string> = { displayLabel };
        if (adapter.supports.login) {
          input.username = username;
          input.password = password;
        }
        result = await connectAdapterAction(adapter.id, input);

        // For login-flow adapters, connectAdapterAction only creates the
        // credential row with empty secrets — it does NOT run adapter.login().
        // Trigger the actual auth flow as a follow-up call so the user reaches
        // NEEDS_OTP / CONNECTED in one click instead of staying at DISCONNECTED.
        if (result.ok && adapter.supports.login) {
          const created = result.data as { id?: string } | undefined;
          if (created?.id) {
            result = await loginAction(created.id, { username, password });
          }
        }
      }

      if (!result.ok) {
        const errKey = mapAdapterError(result.error);
        setErrorMsg(t(errKey));
        return;
      }
      onDone();
    });
  }

  const usernameLabel =
    adapter.category === "email-forward"
      ? t("settings.integrations.form.email_forward")
      : t("settings.integrations.form.username");

  const title = isRelogin
    ? t("settings.integrations.tinkoff_retail.relogin.title")
    : `${t("settings.integrations.action.connect")} — ${
        adapter.displayName.startsWith("settings.")
          ? t(adapter.displayName as Parameters<typeof t>[0])
          : adapter.displayName
      }`;

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
          maxWidth: 400,
          width: "90%",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
          {title}
        </div>

        {isRelogin && (
          <div className="mono" style={{ fontSize: 10, color: "var(--dim)" }}>
            {t("settings.integrations.tinkoff_retail.relogin.password_only_hint")}
          </div>
        )}

        {!isRelogin && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
              {t("settings.integrations.form.display_label")}
            </label>
            <input
              className="settings-input"
              value={displayLabel}
              onChange={(e) => setDisplayLabel(e.target.value)}
              placeholder={
                adapter.displayName.startsWith("settings.")
                  ? t(adapter.displayName as Parameters<typeof t>[0])
                  : adapter.displayName
              }
            />
          </div>
        )}

        {(adapter.supports.login || isRelogin) && (
          <>
            {adapter.id === "tinkoff-retail" && !isRelogin && (
              <InfoCallout tone="info">
                {t("settings.integrations.tinkoff_retail.connect.pin_intro")}
              </InfoCallout>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                {usernameLabel}
              </label>
              <input
                className="settings-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                {...(adapter.id === "tinkoff-retail"
                  ? {
                      inputMode: "tel" as const,
                      placeholder: t("settings.integrations.form.phone_placeholder"),
                    }
                  : {})}
              />
            </div>
            {adapter.category !== "email-forward" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                  {adapter.id === "tinkoff-retail"
                    ? t("settings.integrations.form.pin")
                    : t("settings.integrations.form.password")}
                </label>
                <input
                  className="settings-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  {...(adapter.id === "tinkoff-retail"
                    ? {
                        inputMode: "numeric" as const,
                        maxLength: 4,
                        pattern: "\\d{4}",
                        autoComplete: "off",
                        placeholder: t("settings.integrations.form.pin_placeholder"),
                      }
                    : { autoComplete: "current-password" })}
                />
                {adapter.id === "tinkoff-retail" && (
                  <div className="mono" style={{ fontSize: 10, color: "var(--dim)" }}>
                    {t("settings.integrations.form.pin_hint")}
                  </div>
                )}
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
            {isPending
              ? "..."
              : isRelogin
              ? t("settings.integrations.tinkoff_retail.action.relogin")
              : t("settings.integrations.action.connect")}
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
  onSuccess,
}: {
  credentialId: string;
  onClose: () => void;
  onDone: () => void;
  onSuccess?: () => void;
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
      onSuccess?.();
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

type LinkRow = {
  id: string;
  externalAccountId: string;
  accountId: string;
  label: string | null;
  accountName: string;
  accountCurrency: string;
};

function CredentialCard({
  cred,
  adapter,
  onRefresh,
}: {
  cred: CredentialRow;
  adapter: BankAdapterMeta | null;
  onRefresh: () => void;
}) {
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [reloginAdapter, setReloginAdapter] = useState<BankAdapterMeta | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [accountLinks, setAccountLinks] = useState<LinkRow[]>([]);

  const supportsLinking = adapter?.supports.listExternalAccounts === true;

  const label = cred.displayLabel ?? cred.adapterId;
  const canSync =
    cred.status === "CONNECTED" && adapter?.supports.fetchTransactions;
  const canOtp = cred.status === "NEEDS_OTP" && adapter?.supports.otp;
  const canLogin =
    (cred.status === "ERROR" || cred.status === "DISCONNECTED") &&
    adapter?.supports.login;

  useEffect(() => {
    if (!supportsLinking) return;

    listAccountLinksAction(cred.id).then((res) => {
      if (res.ok) {
        setAccountLinks((res.data as LinkRow[]) ?? []);
      }
    });
  }, [cred.id, supportsLinking]);

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
            ? t("settings.integrations.sync.result", { vars: { created: String(data.created), skipped: String(data.skipped) } })
            : t("settings.integrations.sync.ok"),
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
            {t("settings.integrations.sync.last_sync")} {new Date(cred.lastSyncAt).toLocaleString()}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className="mono" style={{ fontSize: 10, color: "var(--info)" }}>
            {feedback}
          </div>
        )}

        {/* Linked accounts sub-list */}
        {supportsLinking && accountLinks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 2 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
              {t("settings.integrations.tinkoff_retail.link.linked_count", {
                vars: { count: String(accountLinks.length) },
              })}
            </div>
            {accountLinks.map((link) => (
              <div
                key={link.id}
                className="mono"
                style={{ fontSize: 10, color: "var(--dim)", paddingLeft: 8 }}
              >
                {link.label ?? link.externalAccountId} → {link.accountName}
              </div>
            ))}
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
          {canLogin && adapter && (
            <button
              className="btn"
              type="button"
              onClick={() => setReloginAdapter(adapter)}
              disabled={isPending}
            >
              {t("settings.integrations.tinkoff_retail.action.relogin")}
            </button>
          )}
          {supportsLinking && (
            <button
              className="btn"
              type="button"
              onClick={() => setShowLinkDialog(true)}
              disabled={isPending}
            >
              {t("settings.integrations.tinkoff_retail.action.manage_links")}
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
            style={{ color: "var(--neg)", borderColor: "color-mix(in srgb, var(--neg) 35%, transparent)" }}
          >
            {t("settings.integrations.action.delete")}
          </button>
        </div>
      </div>

      {showOtpDialog && (
        <OtpDialog
          credentialId={cred.id}
          onClose={() => setShowOtpDialog(false)}
          onSuccess={() => {
            if (supportsLinking) {
              setShowLinkDialog(true);
            }
          }}
          onDone={() => {
            setShowOtpDialog(false);
            if (!supportsLinking) {
              onRefresh();
            }
          }}
        />
      )}

      {showLinkDialog && (
        <LinkAccountsDialog
          credentialId={cred.id}
          onClose={() => setShowLinkDialog(false)}
          onDone={() => {
            setShowLinkDialog(false);
            onRefresh();
          }}
        />
      )}

      {reloginAdapter && (
        <ConnectDialog
          adapter={reloginAdapter}
          existingCredentialId={cred.id}
          onClose={() => setReloginAdapter(null)}
          onDone={() => {
            setReloginAdapter(null);
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
  const [connectingAdapter, setConnectingAdapter] = useState<BankAdapterMeta | null>(null);

  function refresh() {
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
