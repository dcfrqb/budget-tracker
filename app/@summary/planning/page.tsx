import { CountUp } from "@/components/count-up";
import {
  AvailableBlock,
  BalancesBlock,
  SafeUntilBlock,
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { PLANNING_NEXT } from "@/lib/mock-planning";

function FundsTotal() {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>накопления · итого</span>
        <span className="tiny mono">6 фондов</span>
      </div>
      <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)" }}>
        ₽ <CountUp to={284500} />
      </div>
      <div className="sum-table" style={{ marginTop: 6 }}>
        <div className="r"><span>цель всего</span><span className="v">₽ 1 085 000</span></div>
        <div className="r"><span>прогресс</span><span className="v" style={{ color: "var(--accent)" }}>26%</span></div>
        <div className="r"><span>взнос / мес</span><span className="v">₽ 42 000</span></div>
      </div>
    </div>
  );
}

function NextEvents() {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>ближайшие события</span>
        <span className="tiny mono">14д окно</span>
      </div>
      <div className="next-list">
        {PLANNING_NEXT.map((r, i) => (
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

function HoursToGoal() {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>часы работы до цели</span>
        <span className="tiny mono">ставка ₽ 1 180/ч</span>
      </div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--warn)" }}>
        <CountUp to={388} format="int" /> <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>ч</span>
      </div>
      <div className="sum-table" style={{ marginTop: 6 }}>
        <div className="r"><span>≈ в днях (8ч)</span><span className="v">48.5 дн</span></div>
        <div className="r"><span>≈ в неделях</span><span className="v">10 нед</span></div>
      </div>
    </div>
  );
}

export default function PlanningSummary() {
  return (
    <SummaryShell>
      <SafeUntilBlock />
      <FundsTotal />
      <NextEvents />
      <HoursToGoal />
      <AvailableBlock />
      <BalancesBlock />
      <SessionStateBlock
        rows={[
          { tone: "pos", k: "режим", v: "норма", vClass: "pos" },
          { tone: "pos", k: "вид", v: "планир.", vClass: "acc" },
          { tone: "warn", k: "ближ. дата", v: "28 апр · 7д", vClass: "warn" },
        ]}
      />
    </SummaryShell>
  );
}
