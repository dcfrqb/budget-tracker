"use client";

import { useState, useTransition } from "react";
import { formatMoney } from "@/lib/format/money";
import { Prisma } from "@prisma/client";
import type { TripBookingKind } from "@prisma/client";
import { deleteBookingAction } from "@/app/(shell)/planning/trips/_actions";
import { BookingForm } from "./booking-form";
import { BookingMarkPaidModal } from "./booking-mark-paid-modal";

type Booking = {
  id: string;
  kind: TripBookingKind;
  label: string;
  date: Date;
  amount: string;
  currencyCode: string;
  status: string;
  note: string | null;
};

type Account = { id: string; name: string; currencyCode: string };

type Props = {
  tripId: string;
  bookings: Booking[];
  accounts: Account[];
  currencies: string[];
  labels: {
    title: string;
    add_row: string;
    col_kind: string;
    col_label: string;
    col_date: string;
    col_amount: string;
    col_status: string;
    col_actions: string;
    status: { planned: string; paid: string };
    mark_paid: string;
    mark_paid_modal_title: string;
    mark_paid_account_label: string;
    mark_paid_submit: string;
    edit: string;
    delete: string;
    delete_confirm: string;
    empty: string;
    kind: Record<string, string>;
    cancel: string;
    submit: string;
  };
};

export function TripBookings({ tripId, bookings, accounts, currencies, labels }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    if (!confirm(labels.delete_confirm)) return;
    startTransition(async () => {
      await deleteBookingAction(id, tripId);
    });
  }

  const payingBooking = bookings.find((b) => b.id === payingId);

  return (
    <div className="section trip-bookings fade-in">
      <div className="section-hd">
        <span className="ttl mono dim">{labels.title}</span>
        <button
          className="btn-link acc"
          onClick={() => setShowAddForm(true)}
        >
          {labels.add_row}
        </button>
      </div>

      <table className="trip-bookings-table">
        <thead>
          <tr>
            <th className="dim mono">{labels.col_kind}</th>
            <th className="dim mono">{labels.col_label}</th>
            <th className="dim mono">{labels.col_date}</th>
            <th className="dim mono right">{labels.col_amount}</th>
            <th className="dim mono">{labels.col_status}</th>
            <th className="dim mono">{labels.col_actions}</th>
          </tr>
        </thead>
        <tbody>
          {bookings.length === 0 && !showAddForm && (
            <tr>
              <td colSpan={6} className="dim trip-bookings-empty">{labels.empty}</td>
            </tr>
          )}
          {bookings.map((booking) => {
            if (editingId === booking.id) {
              return (
                <BookingForm
                  key={booking.id}
                  tripId={tripId}
                  bookingId={booking.id}
                  initial={{
                    kind: booking.kind,
                    label: booking.label,
                    date: booking.date.toISOString().slice(0, 10),
                    amount: booking.amount,
                    currencyCode: booking.currencyCode,
                    note: booking.note ?? undefined,
                  }}
                  currencies={currencies}
                  labels={{ ...labels, submit: labels.edit }}
                  onDone={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              );
            }

            const isPaid = booking.status === "PAID";
            const statusLabel = isPaid ? labels.status.paid : labels.status.planned;
            const amount = new Prisma.Decimal(booking.amount);

            return (
              <tr key={booking.id} className={`trip-booking-row${isPaid ? " is-paid" : ""}`}>
                <td className="mono dim">
                  {labels.kind[booking.kind.toLowerCase()] ?? booking.kind}
                </td>
                <td className="mono">{booking.label}</td>
                <td className="mono dim">{booking.date.toISOString().slice(0, 10)}</td>
                <td className="mono right acc">
                  {formatMoney(amount, booking.currencyCode)}
                </td>
                <td>
                  <span className={`pill pill--${booking.status.toLowerCase()}`}>
                    {statusLabel}
                  </span>
                </td>
                <td className="trip-booking-actions">
                  {!isPaid && (
                    <>
                      <button
                        className="btn-link acc"
                        onClick={() => setPayingId(booking.id)}
                      >
                        {labels.mark_paid}
                      </button>
                      <button
                        className="btn-link dim"
                        onClick={() => setEditingId(booking.id)}
                      >
                        {labels.edit}
                      </button>
                      <button
                        className="btn-link neg"
                        onClick={() => handleDelete(booking.id)}
                        disabled={isPending}
                      >
                        {labels.delete}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
          {showAddForm && (
            <BookingForm
              tripId={tripId}
              currencies={currencies}
              labels={{ ...labels, submit: labels.add_row }}
              onDone={() => setShowAddForm(false)}
              onCancel={() => setShowAddForm(false)}
            />
          )}
        </tbody>
      </table>

      {payingId && payingBooking && (
        <BookingMarkPaidModal
          bookingId={payingId}
          accounts={accounts}
          labels={{
            modal_title: labels.mark_paid_modal_title,
            account_label: labels.mark_paid_account_label,
            submit: labels.mark_paid_submit,
            cancel: labels.cancel,
          }}
          onClose={() => setPayingId(null)}
        />
      )}
    </div>
  );
}
