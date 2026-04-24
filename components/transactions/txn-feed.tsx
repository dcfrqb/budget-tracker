"use client";

import React, { useState } from "react";
import { useT } from "@/lib/i18n";
import { TxnRowActions } from "./txn-row-actions";
import type { TxnDayView, TxnView } from "@/lib/view/transactions";
import type { AccountOption } from "@/components/forms/account-select";

type Props = {
  days: TxnDayView[];
  totalCount: number;
  accounts?: AccountOption[];
};

const KIND_LETTER: Record<TxnView["kind"], string> = {
  inc: "I",
  exp: "E",
  xfr: "X",
  loan: "L",
};

const STATUS_CLASS: Record<TxnView["status"], string> = {
  planned: "st-planned",
  partial: "st-partial",
  done: "st-done",
  missed: "st-missed",
  cancel: "st-cancel",
};

function ReimbursableFlag() {
  return (
    <span className="txn-flag" aria-hidden="true">
      <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 2v11M2 4l2-2 2 2" />
        <path d="M11 13V2M9 11l2 2 2-2" />
      </svg>
    </span>
  );
}

interface TxnRowProps {
  t: TxnView;
  accounts: AccountOption[];
  expanded: boolean;
  onToggle: () => void;
}

function TxnRow({ t, accounts, expanded, onToggle }: TxnRowProps) {
  const amtClass = `txn-amt${t.amountStrike ? " strike" : ""} ${t.amountTone ?? ""}`.trim();
  return (
    <div className="txn-row-wrap">
      <div
        className="txn-row"
        tabIndex={0}
        role="button"
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className={`txn-ico ${t.kind}`}>{KIND_LETTER[t.kind]}</div>
        <div className="txn-time">{t.time}</div>
        <div className="txn-main">
          <div className="n">
            {t.name}
            {t.reimbursable && <ReimbursableFlag />}
          </div>
          <div className="m">
            <span className="txn-cat">{t.cat}</span>
            {t.note && <span className={t.noteTone ?? ""}>{t.note}</span>}
          </div>
        </div>
        <div className="txn-acc">{t.account}</div>
        <div className={`txn-status ${STATUS_CLASS[t.status]}`}>{t.statusLabel}</div>
        <div className={amtClass}>{t.amount}</div>
      </div>
      {expanded && (
        <div className="txn-row-actions-wrap">
          <TxnRowActions txn={t} accounts={accounts} />
        </div>
      )}
    </div>
  );
}

interface DayGroupProps {
  day: TxnDayView;
  accounts: AccountOption[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}

function DayGroup({ day, accounts, expandedId, onToggle }: DayGroupProps) {
  return (
    <div className="txn-day">
      <div className="txn-day-hd">
        <span className="date">
          {day.date} <span className="weekday">{day.weekday}</span>
        </span>
        <span className="tot mono">
          {day.totals.map((t, i) => (
            <span key={i}>
              {t.label && `${t.label} `}
              <b className={t.tone}>{t.value}</b>
            </span>
          ))}
        </span>
      </div>
      {day.txns.map((t) => (
        <TxnRow
          key={t.id}
          t={t}
          accounts={accounts}
          expanded={expandedId === t.id}
          onToggle={() => onToggle(t.id)}
        />
      ))}
    </div>
  );
}

export function TxnFeed({ days, totalCount, accounts = [] }: Props) {
  const t = useT();
  const shown = days.reduce((n, d) => n + d.txns.length, 0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="section fade-in" style={{ animationDelay: "180ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("transactions.feed.title")}</b>{" "}
          <span className="dim">{t("transactions.feed.meta")}</span>
        </div>
        <div className="meta mono">
          {t("transactions.feed.shown_of", {
            vars: { shown: String(shown), total: String(totalCount) },
          })}
        </div>
      </div>
      {days.map((day) => (
        <DayGroup
          key={day.date}
          day={day}
          accounts={accounts}
          expandedId={expandedId}
          onToggle={handleToggle}
        />
      ))}
      {shown < totalCount && (
        <div className="txn-more">
          <button type="button" className="btn">
            {t("transactions.feed.load_more")} ↓
          </button>
        </div>
      )}
    </div>
  );
}
