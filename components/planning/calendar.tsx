"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Dialog } from "@/components/ui/dialog";
import { deletePlannedEventAction } from "@/app/(shell)/planning/events/actions";

export type CalendarEvent = {
  id: string;
  date: string;
  weekday: string;
  inDays: string;
  letter: string;
  kind: string;
  name: string;
  sub: string;
  fundLabel?: string;
  amount: string;
  amountTone?: "warn" | "pos" | "muted";
};

export type CalendarMonth = {
  id: string;
  short: string;
  year: string;
  sub: string;
  events: CalendarEvent[];
};

function CalendarEventRow({ event }: { event: CalendarEvent }) {
  const t = useT();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deletePlannedEventAction(event.id);
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <div className={`tl-evt ${event.kind}`} tabIndex={0}>
      <div className="tl-date">{event.date}<b>{event.weekday}</b>{event.inDays}</div>
      <div className={`tl-ico ${event.kind}`}>{event.letter}</div>
      <div className="tl-main">
        <div className="n">{event.name}</div>
        <div className="m">{event.sub}</div>
      </div>
      {event.fundLabel ? (
        <span className="tl-fund">{event.fundLabel}</span>
      ) : (
        <span className="tl-fund none"></span>
      )}
      <div className={`tl-amt ${event.amountTone ?? ""}`}>{event.amount}</div>
      <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
        <Link href={`/planning/events/${event.id}/edit`} className="btn" style={{ fontSize: 10, padding: "2px 6px" }}>
          {t("buttons.edit")}
        </Link>
        <button type="button" className="btn" style={{ fontSize: 10, padding: "2px 6px" }} onClick={() => setDeleteOpen(true)}>
          {t("buttons.delete")}
        </button>
      </div>

      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("forms.event.delete_confirm_title")}
        size="sm"
        footer={
          <div className="submit-row-actions">
            <button type="button" className="btn-ghost" onClick={() => setDeleteOpen(false)} disabled={isPending}>
              {t("forms.common.cancel")}
            </button>
            <button type="button" className="btn-primary" onClick={handleDelete} disabled={isPending}>
              {isPending ? "..." : t("forms.common.delete")}
            </button>
          </div>
        }
      >
        <p className="mono" style={{ fontSize: 13, color: "var(--text)" }}>
          {t("forms.event.delete_confirm_body", { vars: { name: event.name } })}
        </p>
      </Dialog>
    </div>
  );
}

export function PlanningCalendar({ months }: { months: CalendarMonth[] }) {
  const t = useT();
  return (
    <div className="section fade-in" style={{ animationDelay: "180ms" }}>
      <div className="section-hd">
        <div className="ttl mono"><b>{t("planning.calendar.section_title")}</b> <span className="dim">· {t("planning.kpi.next_event")}</span></div>
        <div className="meta mono">
          <Link
            href="/planning/events/new"
            className="btn primary"
            style={{ padding: "3px 9px", fontSize: 10 }}
          >
            {t("buttons.add_event")}
          </Link>
        </div>
      </div>
      <div className="timeline">
        {months.map((m) => (
          <div key={m.id} className="tl-month">
            <div className="tl-mo-label">
              {m.short}<b>{m.year}</b>
              <div className="s">{m.sub}</div>
            </div>
            <div className="tl-events">
              {m.events.map((e) => (
                <CalendarEventRow key={e.id} event={e} />
              ))}
            </div>
          </div>
        ))}
        {months.length === 0 && (
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
            {t("common.no_data")}
          </div>
        )}
      </div>
    </div>
  );
}
