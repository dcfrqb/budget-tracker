import { CountUp } from "@/components/count-up";
import {
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { INST_SHARES, WALLET_BALANCES } from "@/lib/mock-wallet";

function NetHero() {
  return (
    <div className="sum-block" style={{ padding: "12px 8px" }}>
      <div className="net-hero">
        <div className="lbl">
          <span>чистая сумма</span>
          <span className="tiny">в RUB</span>
        </div>
        <div className="row">
          <span className="big mono">₽ <CountUp to={484620} /></span>
        </div>
        <div className="sub mono">всего по 9 счетам · <span className="acc">+3.2%</span> vs мар</div>
      </div>
    </div>
  );
}

function InstShareBlock() {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>доля по институциям</span>
        <span className="tiny mono">от итого</span>
      </div>
      <div className="share-bar">
        {INST_SHARES.map((s, i) => (
          <span key={i} style={{ width: `${s.pct}%`, background: s.color }} title={s.k} />
        ))}
      </div>
      <div className="inst-share">
        {INST_SHARES.map((s, i) => (
          <div key={i} className="r">
            <span className="k"><span className="sw" style={{ background: s.color }} />{s.k}</span>
            <span className="v">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CcyBalances() {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>балансы по валютам</span>
        <span className="tiny mono">9 счетов</span>
      </div>
      {WALLET_BALANCES.map((b) => (
        <div key={b.sym} className="bal-item with-rub">
          <span className="bal-sym mono">{b.sym}</span>
          <span className="bal-val mono">{b.val}</span>
          <span className="bal-rub mono">{b.rub}</span>
        </div>
      ))}
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
        → 2026-06-07 · запас <b style={{ color: "var(--text)" }}>₽ 237 880</b>
      </div>
    </div>
  );
}

export default function WalletSummary() {
  return (
    <SummaryShell>
      <NetHero />
      <InstShareBlock />
      <CcyBalances />
      <SafeBlock />
      <SessionStateBlock
        rows={[
          { tone: "pos", k: "режим", v: "норма", vClass: "pos" },
          { tone: "pos", k: "вид", v: "кошелёк", vClass: "acc" },
          { tone: "warn", k: "курсы", v: "обн 12:30", vClass: "warn" },
        ]}
      />
    </SummaryShell>
  );
}
