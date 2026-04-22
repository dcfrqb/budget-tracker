import { TXN_DAYS, type Txn, type TxnDay } from "@/lib/mock-transactions";

const KIND_LETTER: Record<Txn["kind"], string> = {
  inc:  "I",
  exp:  "E",
  xfr:  "X",
  loan: "L",
};

const STATUS_CLASS: Record<Txn["status"], string> = {
  planned: "st-planned",
  partial: "st-partial",
  done:    "st-done",
  missed:  "st-missed",
  cancel:  "st-cancel",
};

function ReimbursableFlag() {
  return (
    <span className="txn-flag" title="Компенсируется">
      <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 2v11M2 4l2-2 2 2" />
        <path d="M11 13V2M9 11l2 2 2-2" />
      </svg>
    </span>
  );
}

function TxnRow({ t }: { t: Txn }) {
  const amtClass = `txn-amt${t.amountStrike ? " strike" : ""} ${t.amountTone ?? ""}`.trim();
  return (
    <div className="txn-row" tabIndex={0}>
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
  );
}

function DayGroup({ day }: { day: TxnDay }) {
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
        <TxnRow key={t.id} t={t} />
      ))}
    </div>
  );
}

export function TxnFeed() {
  const total = TXN_DAYS.reduce((n, d) => n + d.txns.length, 0);

  return (
    <div className="section fade-in" style={{ animationDelay: "180ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>лента</b> <span className="dim">· новые сверху</span>
        </div>
        <div className="meta mono">{total} из 143 · прокрутка</div>
      </div>
      {TXN_DAYS.map((day) => (
        <DayGroup key={day.date} day={day} />
      ))}
      <div className="txn-more">
        <button type="button" className="btn">Ещё 20 · ↓</button>
      </div>
    </div>
  );
}
