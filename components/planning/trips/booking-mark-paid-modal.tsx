"use client";

import { useState, useTransition } from "react";
import { markBookingPaidAction } from "@/app/(shell)/planning/trips/_actions";

type Account = { id: string; name: string; currencyCode: string };

type Props = {
  bookingId: string;
  accounts: Account[];
  labels: {
    modal_title: string;
    account_label: string;
    submit: string;
    cancel: string;
  };
  onClose: () => void;
};

export function BookingMarkPaidModal({ bookingId, accounts, labels, onClose }: Props) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!accountId) return;
    setError(null);
    startTransition(async () => {
      const result = await markBookingPaidAction({ bookingId, accountId });
      if (result.ok) {
        onClose();
      } else {
        setError(result.formError ?? "error");
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd mono">{labels.modal_title}</div>
        <div className="modal-body">
          <label className="form-row">
            <span className="dim">{labels.account_label}</span>
            <select
              className="form-select mono"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} · {acc.currencyCode}
                </option>
              ))}
            </select>
          </label>
          {error && <div className="form-error neg">{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary dim" onClick={onClose} disabled={isPending}>
            {labels.cancel}
          </button>
          <button className="btn-primary acc" onClick={handleSubmit} disabled={isPending || !accountId}>
            {labels.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
