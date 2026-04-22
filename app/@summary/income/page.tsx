import { CountUp } from "@/components/count-up";
import {
  AvailableBlock,
  BalancesBlock,
  SafeUntilBlock,
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { INCOME_SUMMARY_MONTH, INCOME_UPCOMING } from "@/lib/mock-income";

function IncomeMonthBlock() {
  const m = INCOME_SUMMARY_MONTH;
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>доход в этом мес</span>
        <span className="tiny mono">апр · 72% плана</span>
      </div>
      <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: "var(--pos)" }}>
        +₽ <CountUp to={m.fact} />
      </div>
      <div className="sum-table" style={{ marginTop: 6 }}>
        <div className="r"><span>план</span><span className="v">{m.plan}</span></div>
        {m.rows.map((r) => (
          <div key={r.k} className="r"><span>{r.k}</span><span className="v">{r.v}</span></div>
        ))}
      </div>
    </div>
  );
}

function IncomeUpcomingBlock() {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>ближ. поступления</span>
        <span className="tiny mono">окно 14д</span>
      </div>
      <div className="inc-upcoming">
        {INCOME_UPCOMING.map((r, i) => (
          <div key={i} className="r">
            <span className="d mono">{r.d}</span>
            <span className="n">{r.n}</span>
            <span className="v mono">{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IncomeSummary() {
  return (
    <SummaryShell>
      <SafeUntilBlock />
      <IncomeMonthBlock />
      <IncomeUpcomingBlock />
      <AvailableBlock />
      <BalancesBlock />
      <SessionStateBlock
        rows={[
          { tone: "pos", k: "режим", v: "норма", vClass: "pos" },
          { tone: "pos", k: "вид", v: "доходы", vClass: "acc" },
          { tone: "warn", k: "ожидает", v: "€ 1 200", vClass: "warn" },
        ]}
      />
    </SummaryShell>
  );
}
