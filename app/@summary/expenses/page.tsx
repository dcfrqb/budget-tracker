import {
  AvailableBlock,
  BalancesBlock,
  SafeUntilBlock,
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { EXPENSES_RESERVED, SUBS_MONTHLY } from "@/lib/mock-expenses";

function ReservedBlock() {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>резерв 30д</span>
        <span className="tiny mono">₽ 74 600</span>
      </div>
      <div className="reserved">
        {EXPENSES_RESERVED.map((r) => (
          <div key={r.k} className="r">
            <span><span className={`c ${r.tag}`} />{r.k}</span>
            <span className="mono" style={{ color: r.tone }}>{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubsMonthlyBlock() {
  const toneMap = { text: "var(--text)", info: "var(--info)", acc: "var(--accent)" } as const;
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>подписки · тариф/мес</span>
        <span className="tiny mono">₽ 4 890</span>
      </div>
      <div className="sum-table">
        {SUBS_MONTHLY.map((r) => (
          <div key={r.k} className="r">
            <span>{r.k}</span>
            <span className="mono" style={{ color: toneMap[r.tone] }}>{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExpensesSummary() {
  return (
    <SummaryShell>
      <SafeUntilBlock />
      <ReservedBlock />
      <AvailableBlock />
      <SubsMonthlyBlock />
      <BalancesBlock />
      <SessionStateBlock
        rows={[
          { tone: "pos", k: "режим", v: "норма", vClass: "pos" },
          { tone: "warn", k: "ближ. событие", v: "28 апр · 7д", vClass: "warn" },
          { tone: "pos", k: "срочно", v: "₽ 57 400", vClass: "neg" },
        ]}
      />
    </SummaryShell>
  );
}
