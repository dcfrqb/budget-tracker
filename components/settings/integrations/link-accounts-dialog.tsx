"use client";

import { useEffect, useState, useTransition } from "react";
import { useT } from "@/lib/i18n";
import {
  listExternalAccountsAction,
  listAccountLinksAction,
  listUserAccountsAction,
  linkExternalAccountAction,
  unlinkExternalAccountAction,
} from "@/app/(shell)/settings/integrations/actions";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type ExternalAccount = {
  externalAccountId: string;
  label: string;
  currencyCode: string;
};

type AccountLink = {
  id: string;
  externalAccountId: string;
  accountId: string;
  label: string | null;
  accountName: string;
  accountCurrency: string;
};

type LocalAccount = {
  id: string;
  name: string;
  currencyCode: string;
};

type Props = {
  credentialId: string;
  onClose: () => void;
  onDone: () => void;
};

// ─────────────────────────────────────────────────────────────
// LinkAccountsDialog
// ─────────────────────────────────────────────────────────────

export function LinkAccountsDialog({ credentialId, onClose, onDone }: Props) {
  const t = useT();
  const [isPending, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [externalAccounts, setExternalAccounts] = useState<ExternalAccount[]>([]);
  const [existingLinks, setExistingLinks] = useState<AccountLink[]>([]);
  const [localAccounts, setLocalAccounts] = useState<LocalAccount[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});

  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [extRes, linksRes, localRes] = await Promise.all([
          listExternalAccountsAction(credentialId),
          listAccountLinksAction(credentialId),
          listUserAccountsAction(),
        ]);

        if (cancelled) return;

        if (!extRes.ok) {
          setLoadError(extRes.error);
          setLoading(false);
          return;
        }
        if (!linksRes.ok) {
          setLoadError(linksRes.error);
          setLoading(false);
          return;
        }
        if (!localRes.ok) {
          setLoadError(localRes.error);
          setLoading(false);
          return;
        }

        const ext = (extRes.data as ExternalAccount[]) ?? [];
        const links = (linksRes.data as AccountLink[]) ?? [];
        const local = (localRes.data as LocalAccount[]) ?? [];

        setExternalAccounts(ext);
        setExistingLinks(links);
        setLocalAccounts(local);

        const initialSelections: Record<string, string> = {};
        for (const ea of ext) {
          const existingLink = links.find((l) => l.externalAccountId === ea.externalAccountId);
          initialSelections[ea.externalAccountId] = existingLink ? existingLink.accountId : "";
        }
        setSelections(initialSelections);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [credentialId]);

  function handleSelectionChange(externalAccountId: string, accountId: string) {
    setSelections((prev) => ({ ...prev, [externalAccountId]: accountId }));
  }

  function handleSave() {
    setSaveError(null);
    startTransition(async () => {
      try {
        const ops: Promise<{ ok: boolean; error?: string }>[] = [];

        for (const ea of externalAccounts) {
          const selectedId = selections[ea.externalAccountId] ?? "";
          const existingLink = existingLinks.find(
            (l) => l.externalAccountId === ea.externalAccountId,
          );
          const previousId = existingLink?.accountId ?? "";

          if (selectedId === previousId) continue;

          if (selectedId === "" && existingLink) {
            ops.push(
              unlinkExternalAccountAction({
                credentialId,
                externalAccountId: ea.externalAccountId,
              }),
            );
          } else if (selectedId !== "") {
            ops.push(
              linkExternalAccountAction({
                credentialId,
                externalAccountId: ea.externalAccountId,
                accountId: selectedId,
                label: ea.label,
              }),
            );
          }
        }

        const results = await Promise.all(ops);
        const failed = results.find((r) => !r.ok);
        if (failed && !failed.ok) {
          setSaveError((failed as { ok: false; error: string }).error);
          return;
        }

        onDone();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--overlay-strong)",
  };

  const panelStyle: React.CSSProperties = {
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: 24,
    maxWidth: 520,
    width: "92%",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    maxHeight: "80vh",
    overflowY: "auto",
  };

  return (
    <div role="dialog" aria-modal="true" style={overlayStyle}>
      <div style={panelStyle}>
        <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
          {t("settings.integrations.tinkoff_retail.link.title")}
        </div>

        {loading && (
          <div className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>
            {t("settings.integrations.tinkoff_retail.link.loading")}
          </div>
        )}

        {!loading && loadError && (
          <div className="sig warn">
            <div className="m mono" style={{ fontSize: 11 }}>{loadError}</div>
          </div>
        )}

        {!loading && !loadError && externalAccounts.length === 0 && (
          <div className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>
            {t("settings.integrations.tinkoff_retail.link.no_external_accounts")}
          </div>
        )}

        {!loading && !loadError && externalAccounts.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: "var(--muted)",
                    textAlign: "left",
                    paddingBottom: 8,
                    fontWeight: 400,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {t("settings.integrations.tinkoff_retail.link.column.tbank_account")}
                </th>
                <th
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: "var(--muted)",
                    textAlign: "left",
                    paddingBottom: 8,
                    paddingLeft: 12,
                    fontWeight: 400,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {t("settings.integrations.tinkoff_retail.link.column.currency")}
                </th>
                <th
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: "var(--muted)",
                    textAlign: "left",
                    paddingBottom: 8,
                    paddingLeft: 12,
                    fontWeight: 400,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {t("settings.integrations.tinkoff_retail.link.column.local_account")}
                </th>
              </tr>
            </thead>
            <tbody>
              {externalAccounts.map((ea) => {
                const matchingLocal = localAccounts.filter(
                  (la) => la.currencyCode === ea.currencyCode,
                );
                const options = matchingLocal.length > 0 ? matchingLocal : localAccounts;

                return (
                  <tr key={ea.externalAccountId}>
                    <td
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: "var(--text)",
                        paddingTop: 8,
                        paddingBottom: 8,
                        borderBottom: "1px solid var(--border)",
                        opacity: 0.9,
                      }}
                    >
                      {ea.label}
                    </td>
                    <td
                      className="mono"
                      style={{
                        fontSize: 10,
                        color: "var(--dim)",
                        paddingTop: 8,
                        paddingBottom: 8,
                        paddingLeft: 12,
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {ea.currencyCode}
                    </td>
                    <td
                      style={{
                        paddingTop: 6,
                        paddingBottom: 6,
                        paddingLeft: 12,
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <select
                        className="settings-input mono"
                        style={{ fontSize: 11, width: "100%" }}
                        value={selections[ea.externalAccountId] ?? ""}
                        onChange={(e) =>
                          handleSelectionChange(ea.externalAccountId, e.target.value)
                        }
                      >
                        <option value="">
                          {t("settings.integrations.tinkoff_retail.link.unlinked_option")}
                        </option>
                        {options.map((la) => (
                          <option key={la.id} value={la.id}>
                            {la.name} ({la.currencyCode})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {saveError && (
          <div className="sig warn">
            <div className="m mono" style={{ fontSize: 11 }}>{saveError}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn" type="button" onClick={onClose} disabled={isPending || loading}>
            {t("common.close")}
          </button>
          {!loading && !loadError && externalAccounts.length > 0 && (
            <button
              className="btn primary"
              type="button"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending
                ? "..."
                : t("settings.integrations.tinkoff_retail.link.save")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
