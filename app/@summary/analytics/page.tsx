import { CountUp } from "@/components/count-up";
import {
  BalancesBlock,
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { Sparkline } from "@/components/shell/sparkline";
import { CASHFLOW_30D } from "@/lib/mock";
import { TOP_DELTAS, WX_FACTORS } from "@/lib/mock-analytics";

function PeriodHero() {
  return (
    <div className="sum-block" style={{ padding: "12px 8px" }}>
      <div className="period-hero">
        <div className="lbl">
          <span>период · 3 мес</span>
          <span className="tiny">фев – апр</span>
        </div>
        <div className="row">
          <span className="big mono"><CountUp to={130800} /></span>
          <span className="unit mono">₽/мес</span>
        </div>
        <div className="sub mono">средний нетто · <span className="acc">▲ 22%</span> vs пред.</div>
      </div>
    </div>
  );
}

function SafeBlock() {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>безопасно до</span>
        <span className="tiny mono">режим: норма</span>
      </div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>
        <CountUp to={47} format="int" /> <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 500 }}>дней</span>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
        → 2026-06-07 · <span className="acc">+2д</span> vs пред. неделя
      </div>
    </div>
  );
}

function WxFactorsBlock() {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>погода · факторы</span>
        <span className="tiny mono">5/10 солн.</span>
      </div>
      <div className="period-stats">
        {WX_FACTORS.map((f, i) => (
          <div key={i} className="r">
            <span className="k">{f.k}</span>
            <span className={`v ${f.tone}`}>{f.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopDeltasBlock() {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>топ прирост · кат</span>
        <span className="tiny mono">м/м</span>
      </div>
      <div className="period-stats">
        {TOP_DELTAS.map((d, i) => (
          <div key={i} className="r">
            <span className="k">{d.k}</span>
            <span className={`v ${d.tone}`}>{d.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CashflowLive() {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>денежный поток 90д</span>
        <span className="tiny mono">live</span>
      </div>
      <Sparkline points={CASHFLOW_30D} />
      <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 4, letterSpacing: ".1em" }}>
        ▁▂▃▃▅▇▇ +14% vs мар
      </div>
    </div>
  );
}

export default function AnalyticsSummary() {
  return (
    <SummaryShell>
      <PeriodHero />
      <SafeBlock />
      <WxFactorsBlock />
      <TopDeltasBlock />
      <BalancesBlock />
      <CashflowLive />
      <SessionStateBlock
        rows={[
          { tone: "pos", k: "режим", v: "норма", vClass: "pos" },
          { tone: "pos", k: "вид", v: "аналитика", vClass: "acc" },
        ]}
      />
    </SummaryShell>
  );
}
