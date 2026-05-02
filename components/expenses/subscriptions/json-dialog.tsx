"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { subscriptionsBulkReplaceSchema } from "@/lib/validation/subscription";
import { replaceSubscriptionsAction } from "@/app/(shell)/expenses/subscriptions/actions";

// ── Types ──────────────────────────────────────────────────────────────────

type DiffSummary = { created: number; updated: number; deleted: number };

type ValidationState =
  | { kind: "empty" }
  | { kind: "parse_error"; message: string }
  | { kind: "schema_error"; path: string; message: string }
  | { kind: "valid"; diff: DiffSummary };

// ── Example template shown when no subscriptions exist ─────────────────────

const EXAMPLE_TEMPLATE = JSON.stringify(
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

// ── Diff helper (client-side) ──────────────────────────────────────────────

function computeDiff(
  existingIds: string[],
  items: Array<{ id?: string }>,
): DiffSummary {
  const existingSet = new Set(existingIds);
  const incomingIds = new Set(
    items
      .filter((i) => i.id && existingSet.has(i.id))
      .map((i) => i.id!),
  );
  const toCreate = items.filter((i) => !i.id || !existingSet.has(i.id)).length;
  const toUpdate = items.filter((i) => i.id && existingSet.has(i.id)).length;
  const toDelete = existingIds.filter((id) => !incomingIds.has(id)).length;
  return { created: toCreate, updated: toUpdate, deleted: toDelete };
}

// ── Props ──────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Serialized current subscriptions JSON (or empty string for empty list). */
  initialJson: string;
  /** Existing subscription IDs for diff computation. */
  existingIds: string[];
};

// ── Component ─────────────────────────────────────────────────────────────

export function SubscriptionsJsonDialog({ open, onOpenChange, initialJson, existingIds }: Props) {
  const t = useT();
  const [jsonText, setJsonText] = useState(initialJson || EXAMPLE_TEMPLATE);
  const [validation, setValidation] = useState<ValidationState>({ kind: "empty" });
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setJsonText(initialJson || EXAMPLE_TEMPLATE);
      setValidation({ kind: "empty" });
      setConfirming(false);
    }
  }, [open, initialJson]);

  const validate = useCallback(
    (text: string): ValidationState => {
      const trimmed = text.trim();
      if (!trimmed) return { kind: "empty" };

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        return { kind: "parse_error", message: (e as SyntaxError).message };
      }

      const result = subscriptionsBulkReplaceSchema.safeParse(parsed);
      if (!result.success) {
        const first = result.error.issues[0];
        const path = first.path.join(".");
        return { kind: "schema_error", path, message: first.message };
      }

      const diff = computeDiff(existingIds, result.data as Array<{ id?: string }>);
      return { kind: "valid", diff };
    },
    [existingIds],
  );

  function handleChange(text: string) {
    setJsonText(text);
    setConfirming(false);
    setValidation(validate(text));
  }

  function handleClose(val: boolean) {
    if (!val) {
      setConfirming(false);
    }
    onOpenChange(val);
  }

  function handleApplyClick() {
    if (validation.kind !== "valid") return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText.trim());
      } catch {
        return;
      }
      const res = await replaceSubscriptionsAction(parsed);
      if (res.ok) {
        handleClose(false);
      } else {
        setValidation({ kind: "schema_error", path: "", message: res.error });
        setConfirming(false);
      }
    });
  }

  const isValid = validation.kind === "valid";
  const canApply = isValid && !isPending;

  const footer = (
    <div className="sub-json-footer">
      <button
        type="button"
        className="btn"
        onClick={() => handleClose(false)}
        disabled={isPending}
      >
        {t("expenses.subscriptions.json.cancel")}
      </button>
      <button
        type="button"
        className="btn primary"
        onClick={handleApplyClick}
        disabled={!canApply}
      >
        {isPending ? "…" : confirming
          ? t("expenses.subscriptions.json.confirm_apply")
          : t("expenses.subscriptions.json.apply")}
      </button>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title={t("expenses.subscriptions.json.title")}
      footer={footer}
      size="md"
    >
      <div className="sub-json-body">
        {!initialJson && (
          <p className="sub-json-hint mono">
            {t("expenses.subscriptions.json.empty_hint")}
          </p>
        )}

        <textarea
          className="sub-json-textarea"
          value={jsonText}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              const el = e.currentTarget;
              const start = el.selectionStart;
              const end = el.selectionEnd;
              const next = jsonText.slice(0, start) + "  " + jsonText.slice(end);
              setJsonText(next);
              setValidation(validate(next));
              requestAnimationFrame(() => {
                el.selectionStart = el.selectionEnd = start + 2;
              });
            }
          }}
          rows={12}
          spellCheck={false}
        />

        <div className="sub-json-status">
          {validation.kind === "empty" && (
            <span className="sub-json-status-idle mono">—</span>
          )}
          {validation.kind === "parse_error" && (
            <span className="sub-json-status-err mono">
              {t("expenses.subscriptions.json.parse_error", {
                vars: { message: validation.message },
              })}
            </span>
          )}
          {validation.kind === "schema_error" && (
            <span className="sub-json-status-err mono">
              {t("expenses.subscriptions.json.schema_error", {
                vars: { path: validation.path || "–", message: validation.message },
              })}
            </span>
          )}
          {validation.kind === "valid" && (
            <span className="sub-json-status-ok mono">
              {t("expenses.subscriptions.json.valid")}{" "}
              <span className="sub-json-diff">
                {t("expenses.subscriptions.json.diff_summary", {
                  vars: {
                    created: validation.diff.created,
                    updated: validation.diff.updated,
                    deleted: validation.diff.deleted,
                  },
                })}
              </span>
            </span>
          )}
        </div>

        {confirming && validation.kind === "valid" && (
          <div className="sub-json-confirm">
            {t("expenses.subscriptions.json.diff_summary", {
              vars: {
                created: validation.diff.created,
                updated: validation.diff.updated,
                deleted: validation.diff.deleted,
              },
            })}
            {" — "}
            {t("expenses.subscriptions.json.confirm_apply")}
          </div>
        )}
      </div>
    </Dialog>
  );
}
