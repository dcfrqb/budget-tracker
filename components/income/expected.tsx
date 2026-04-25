import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export type ExpectedRow = {
  id: string;
  date: string;
  weekday: string;
  inDays: string;
  name: string;
  sub: string;
  src: string;
  status: "confirmed" | "expected" | "await";
  statusLabel: string;
  amount: string;
};

const STATUS_CLASS = { confirmed: "st-confirmed", expected: "st-expected", await: "st-await" } as const;

export async function ExpectedIncome({ rows }: { rows: ExpectedRow[] }) {
  const t = await getT();

  return (
    <div className="section fade-in" style={{ animationDelay: "180ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>{t("income.expected.status_label").toLowerCase()}</b>{" "}
          <span className="dim">· {t("income.expected.events_count", { vars: { count: String(rows.length) } })}</span>
        </div>
        <div className="meta mono">
          <Link
            href="/transactions/new?kind=INCOME&status=PLANNED"
            className="btn primary"
            style={{ padding: "3px 9px", fontSize: 10 }}
          >
            {t("income.expected.add")}
          </Link>
        </div>
      </div>
      <div className="section-body flush">
        {rows.map((e) => (
          <div key={e.id} className="expected-row" tabIndex={0}>
            <div className="exp-date mono">
              {e.date}
              <b>{e.weekday}</b>
              {e.inDays}
            </div>
            <div className="exp-main">
              <div className="n">{e.name}</div>
              <div className="m">{e.sub}</div>
            </div>
            <span className="exp-src mono">{e.src}</span>
            <span className={`exp-st ${STATUS_CLASS[e.status]}`}>{e.statusLabel}</span>
            <div className="exp-amt">{e.amount}</div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", padding: "12px 20px" }}>
            {t("income.expected.empty")}
          </div>
        )}
      </div>
    </div>
  );
}
