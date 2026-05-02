"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { importSubscriptionsAction, type ImportResult } from "@/app/(shell)/expenses/subscriptions/import-action";

const SAMPLE_JSON = JSON.stringify(
  [
    {
      name: "Spotify",
      price: "299.00",
      currencyCode: "RUB",
      billingIntervalMonths: 1,
      nextPaymentDate: "2026-06-01",
      sharingType: "PERSONAL",
      icon: "spotify",
      iconColor: "#1DB954",
      iconBg: "#121212",
    },
  ],
  null,
  2,
);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SubscriptionImportDialog({ open, onOpenChange }: Props) {
  const t = useT();
  const [jsonText, setJsonText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const res = await importSubscriptionsAction(jsonText);
      setResult(res);
    });
  }

  function handleClose(val: boolean) {
    if (!val) {
      setJsonText("");
      setResult(null);
    }
    onOpenChange(val);
  }

  const footer = (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <button
        type="button"
        className="btn"
        onClick={() => handleClose(false)}
        disabled={isPending}
      >
        {t("common.close")}
      </button>
      <button
        type="button"
        className="btn primary"
        onClick={handleSubmit}
        disabled={isPending || !jsonText.trim()}
      >
        {isPending ? "…" : t("expenses.subscriptions.import.submit")}
      </button>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title={t("expenses.subscriptions.import.title")}
      footer={footer}
      size="md"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>
          {t("expenses.subscriptions.import.hint")}
        </p>

        <textarea
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            setResult(null);
          }}
          rows={8}
          placeholder="[ … ]"
          style={{
            width: "100%",
            resize: "vertical",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--fg)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            padding: "8px",
            boxSizing: "border-box",
          }}
        />

        <details>
          <summary
            className="mono"
            style={{ fontSize: 10, color: "var(--muted)", cursor: "pointer" }}
          >
            {t("expenses.subscriptions.import.sample_label")}
          </summary>
          <pre
            style={{
              marginTop: 6,
              padding: 8,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--muted)",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {SAMPLE_JSON}
          </pre>
        </details>

        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {!result.ok && result.parseError && (
              <p
                className="mono"
                style={{ color: "var(--danger)", fontSize: 11 }}
              >
                {t("expenses.subscriptions.import.parse_error")}
              </p>
            )}
            {result.ok && (
              <>
                <p
                  className="mono"
                  style={{ color: "var(--success)", fontSize: 11 }}
                >
                  {t("expenses.subscriptions.import.success", {
                    vars: { n: result.created },
                  })}
                </p>
                {result.errors.length > 0 && (
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    {result.errors.map((e) => (
                      <li
                        key={e.index}
                        className="mono"
                        style={{ color: "var(--danger)", fontSize: 10 }}
                      >
                        {t("expenses.subscriptions.import.error_row", {
                          vars: {
                            index: e.index,
                            message: e.message,
                          },
                        })}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
