import { CountUp } from "@/components/count-up";

// ─────────────────────────────────────────────────────────────
// Types for summary blocks — passed from page-level data fetch
// ─────────────────────────────────────────────────────────────

export type SafeUntilData = {
  days: number | null;
  /** ISO date string, e.g. "2026-06-07" */
  dateIso?: string;
  deltaLabel?: string;
};

export type AvailableData = {
  freeBase: number;
  totalBase: number;
  reservedBase: number;
};

export type BalanceData = {
  sym: string;
  display: string;
};

export type StatusData = {
  label: string;
};

// ─────────────────────────────────────────────────────────────
// SafeUntilBlock — accepts optional props; shows "—" if no data
// ─────────────────────────────────────────────────────────────

export function SafeUntilBlock({ data }: { data?: SafeUntilData }) {
  const days = data?.days ?? null;
  const dateIso = data?.dateIso;
  const deltaLabel = data?.deltaLabel;

  return (
    <div className="sum-block" style={{ padding: "12px 8px" }}>
      <div className="safe-block">
        <div className="lbl">
          <span>безопасно до</span>
          <span className="tiny">@ нулевой доход</span>
        </div>
        <div className="row">
          <span className="big mono">
            {days !== null ? <CountUp to={days} format="int" /> : "—"}
          </span>
          <span className="unit mono">дней</span>
        </div>
        {(dateIso || deltaLabel) && (
          <div className="sub mono">
            {dateIso && <>→ {dateIso}</>}
            {deltaLabel && <> · <span className="acc">{deltaLabel}</span></>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AvailableBlock
// ─────────────────────────────────────────────────────────────

export function AvailableBlock({ data }: { data?: AvailableData }) {
  const freeBase = data?.freeBase ?? 0;
  const totalBase = data?.totalBase ?? 0;
  const reservedBase = data?.reservedBase ?? 0;

  return (
    <div className="sum-block avail">
      <div className="lbl">
        <span>доступно сейчас</span>
      </div>
      <div className="big2 mono">
        ₽ <CountUp to={freeBase} />
      </div>
      <div className="sub">
        <span>
          всего{" "}
          <span className="mono" style={{ color: "var(--muted)" }}>
            {totalBase.toLocaleString("en-US").replace(/,/g, " ")}
          </span>
        </span>
        <span>
          резерв{" "}
          <span className="mono" style={{ color: "var(--warn)" }}>
            {reservedBase.toLocaleString("en-US").replace(/,/g, " ")}
          </span>
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BalancesBlock
// ─────────────────────────────────────────────────────────────

export function BalancesBlock({ balances }: { balances?: BalanceData[] }) {
  const rows = balances ?? [];
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>балансы</span>
        {rows.length > 0 && <span className="tiny mono">{rows.length} счёта</span>}
      </div>
      {rows.map((b) => (
        <div key={b.sym} className="bal-item">
          <span className="bal-sym mono">{b.sym}</span>
          <span className="bal-val mono">{b.display}</span>
        </div>
      ))}
      {rows.length === 0 && (
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>нет данных</div>
      )}
    </div>
  );
}

type SessionRow = { tone: "pos" | "warn" | "muted" | "live-pos"; k: string; v: React.ReactNode; vClass?: string };

export function SessionStateBlock({ status, rows }: { status?: StatusData; rows: SessionRow[] }) {
  const statusLabel = status?.label ?? "СТАБИЛЬНО";
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>состояние сессии</span>
        <span className="tiny mono">онлайн</span>
      </div>
      <div className="status-row">
        <span className="dot live" style={{ background: "var(--pos)" }} />
        <span className="k">статус</span>
        <span className="v acc">{statusLabel}</span>
      </div>
      {rows.map((r, i) => {
        const bg =
          r.tone === "pos" ? "var(--pos)" :
          r.tone === "warn" ? "var(--warn)" :
          r.tone === "muted" ? "var(--muted)" :
          "var(--pos)";
        return (
          <div key={i} className="status-row">
            <span className={`dot${r.tone === "live-pos" ? " live" : ""}`} style={{ background: bg }} />
            <span className="k">{r.k}</span>
            <span className={`v ${r.vClass ?? ""}`}>{r.v}</span>
          </div>
        );
      })}
    </div>
  );
}

export function QuickButtons() {
  return (
    <div className="sum-block" style={{ borderBottom: 0 }}>
      <div className="lbl">
        <span>быстро</span>
      </div>
      <div className="sum-quick">
        <button title="Доход (I)">+ Доход</button>
        <button title="Расход (E)">+ Расход</button>
        <button title="Транзакция (T)">+ Транз</button>
      </div>
    </div>
  );
}

export function SummaryShell({ children }: { children: React.ReactNode }) {
  return (
    <aside className="summary-rail" aria-label="Сводка">
      {children}
    </aside>
  );
}
