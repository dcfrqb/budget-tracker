"use client";

import { useState, useTransition } from "react";
import type { TripBookingKind } from "@prisma/client";
import { createBookingAction, updateBookingAction } from "@/app/(shell)/planning/trips/_actions";

type Props = {
  tripId: string;
  bookingId?: string;
  initial?: {
    kind: TripBookingKind;
    label: string;
    date: string;
    amount: string;
    currencyCode: string;
    note?: string;
  };
  currencies: string[];
  labels: {
    col_kind: string;
    col_label: string;
    col_date: string;
    col_amount: string;
    add_row: string;
    kind: Record<string, string>;
    submit: string;
    cancel: string;
  };
  onDone: () => void;
  onCancel: () => void;
};

const BOOKING_KINDS: TripBookingKind[] = [
  "TRANSPORT",
  "LODGING",
  "FOOD",
  "ACTIVITY",
  "OTHER",
];

export function BookingForm({
  tripId,
  bookingId,
  initial,
  currencies,
  labels,
  onDone,
  onCancel,
}: Props) {
  const [kind, setKind] = useState<TripBookingKind>(initial?.kind ?? "OTHER");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [currencyCode, setCurrencyCode] = useState(initial?.currencyCode ?? currencies[0] ?? "RUB");
  const [note, setNote] = useState(initial?.note ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!label.trim() || !amount.trim()) return;
    setError(null);

    startTransition(async () => {
      let result;
      if (bookingId) {
        result = await updateBookingAction(bookingId, {
          kind,
          label: label.trim(),
          date,
          amount,
          currencyCode,
          note: note.trim() || null,
        });
      } else {
        result = await createBookingAction({
          tripId,
          kind,
          label: label.trim(),
          date,
          amount,
          currencyCode,
          note: note.trim() || null,
        });
      }
      if (result.ok) {
        onDone();
      } else {
        setError("error");
      }
    });
  }

  return (
    <tr className="booking-form-row">
      <td>
        <select
          className="form-select mono"
          value={kind}
          onChange={(e) => setKind(e.target.value as TripBookingKind)}
        >
          {BOOKING_KINDS.map((k) => (
            <option key={k} value={k}>
              {labels.kind[k.toLowerCase()] ?? k}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          className="form-input mono"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={labels.col_label}
        />
      </td>
      <td>
        <input
          className="form-input mono"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </td>
      <td className="booking-form-amount-cell">
        <input
          className="form-input mono booking-form-amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
        />
        <select
          className="form-select mono booking-form-ccy"
          value={currencyCode}
          onChange={(e) => setCurrencyCode(e.target.value)}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </td>
      <td />
      <td className="booking-form-actions">
        <button
          className="btn-primary acc"
          onClick={handleSubmit}
          disabled={isPending || !label.trim() || !amount.trim()}
        >
          {labels.submit}
        </button>
        <button className="btn-secondary dim" onClick={onCancel} disabled={isPending}>
          {labels.cancel}
        </button>
        {error && <span className="neg">{error}</span>}
      </td>
    </tr>
  );
}
