import { CountUp } from "@/components/count-up";
import { AVAILABLE, BALANCES, SAFE_UNTIL, STATUS } from "@/lib/mock";

export function SafeUntilBlock() {
  return (
    <div className="sum-block" style={{ padding: "12px 8px" }}>
      <div className="safe-block">
        <div className="lbl">
          <span>безопасно до</span>
          <span className="tiny">@ нулевой доход</span>
        </div>
        <div className="row">
          <span className="big mono">
            <CountUp to={SAFE_UNTIL.days} format="int" />
          </span>
          <span className="unit mono">дней</span>
        </div>
        <div className="sub mono">
          → {SAFE_UNTIL.dateIso} · <span className="acc">{SAFE_UNTIL.deltaLabel}</span>
        </div>
      </div>
    </div>
  );
}

export function AvailableBlock() {
  return (
    <div className="sum-block avail">
      <div className="lbl">
        <span>доступно сейчас</span>
      </div>
      <div className="big2 mono">
        ₽ <CountUp to={AVAILABLE.now} />
      </div>
      <div className="sub">
        <span>
          всего{" "}
          <span className="mono" style={{ color: "var(--muted)" }}>
            {AVAILABLE.total.toLocaleString("en-US").replace(/,/g, " ")}
          </span>
        </span>
        <span>
          резерв{" "}
          <span className="mono" style={{ color: "var(--warn)" }}>
            {AVAILABLE.reserved.toLocaleString("en-US").replace(/,/g, " ")}
          </span>
        </span>
      </div>
    </div>
  );
}

export function BalancesBlock() {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>балансы</span>
        <span className="tiny mono">{BALANCES.length} счёта</span>
      </div>
      {BALANCES.map((b) => (
        <div key={b.sym} className="bal-item">
          <span className="bal-sym mono">{b.sym}</span>
          <span className="bal-val mono">{b.display}</span>
        </div>
      ))}
    </div>
  );
}

type SessionRow = { tone: "pos" | "warn" | "muted" | "live-pos"; k: string; v: React.ReactNode; vClass?: string };

export function SessionStateBlock({ rows }: { rows: SessionRow[] }) {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>состояние сессии</span>
        <span className="tiny mono">онлайн</span>
      </div>
      <div className="status-row">
        <span className="dot live" style={{ background: "var(--pos)" }} />
        <span className="k">статус</span>
        <span className="v acc">{STATUS.label}</span>
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
