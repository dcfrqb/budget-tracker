"use client";

import React, { useState, useTransition } from "react";
import { useT } from "@/lib/i18n";
import {
  createShareAction,
  deleteShareAction,
} from "@/app/(shell)/expenses/subscriptions/actions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function errMsg(e: any): string | undefined {
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e?.message === "string") return e.message;
  return undefined;
}

export type ShareItem = {
  id: string;
  person: string;
  amount: string | null;
};

interface SharesEditorProps {
  subscriptionId: string;
  initialShares: ShareItem[];
  isSplit: boolean;
}

export function SharesEditor({
  subscriptionId,
  initialShares,
  isSplit,
}: SharesEditorProps) {
  const t = useT();
  const [shares, setShares] = useState<ShareItem[]>(initialShares);
  const [isPending, startTransition] = useTransition();

  // New share form state
  const [newPerson, setNewPerson] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  if (!isSplit) return null;

  function handleAdd() {
    setAddError(null);
    if (!newPerson.trim()) {
      setAddError(t("forms.common.required"));
      return;
    }
    startTransition(async () => {
      const result = await createShareAction(subscriptionId, {
        person: newPerson.trim(),
        amount: newAmount ? newAmount : null,
      });
      if (!result.ok) {
        setAddError(result.formError ?? t("forms.common.form_error.internal"));
        return;
      }
      const created = result.data as { id: string; person: string; amount: unknown };
      setShares((prev) => [
        ...prev,
        {
          id: created.id,
          person: created.person,
          amount: created.amount != null ? String(created.amount) : null,
        },
      ]);
      setNewPerson("");
      setNewAmount("");
    });
  }

  function handleDelete(shareId: string) {
    startTransition(async () => {
      const result = await deleteShareAction(shareId);
      if (!result.ok) return;
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    });
  }

  return (
    <div className="shares-editor">
      <div className="shares-editor-title mono">{t("forms.sub.shares_editor.title")}</div>

      {shares.length === 0 ? (
        <div className="shares-editor-empty mono">{t("forms.sub.shares_editor.empty")}</div>
      ) : (
        <ul className="shares-editor-list">
          {shares.map((share) => (
            <li key={share.id} className="shares-editor-item">
              <span className="share-person">{share.person}</span>
              {share.amount && (
                <span className="share-amount">{share.amount}</span>
              )}
              <button
                type="button"
                className="btn-ghost"
                onClick={() => handleDelete(share.id)}
                disabled={isPending}
              >
                {t("forms.sub.shares_editor.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="shares-editor-add">
        <div className="form-row">
          <div className="field">
            <label className="field-label">{t("forms.sub.shares_editor.field_person")}</label>
            <input
              type="text"
              value={newPerson}
              onChange={(e) => setNewPerson(e.target.value)}
              placeholder={t("forms.sub.shares_editor.field_person")}
            />
          </div>
          <div className="field">
            <label className="field-label">{t("forms.sub.shares_editor.field_amount")}</label>
            <input
              type="text"
              inputMode="decimal"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        {addError && <span className="field-error">{addError}</span>}
        <button
          type="button"
          className="btn-primary"
          onClick={handleAdd}
          disabled={isPending}
        >
          {t("forms.sub.shares_editor.add")}
        </button>
      </div>
    </div>
  );
}
