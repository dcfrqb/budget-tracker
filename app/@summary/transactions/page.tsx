import {
  AvailableBlock,
  BalancesBlock,
  QuickButtons,
  SafeUntilBlock,
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { TXN_FILTER_SUMMARY } from "@/lib/mock-transactions";

function FilterBlock() {
  const f = TXN_FILTER_SUMMARY;
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>фильтр</span>
        <span className="tiny mono">30д · все</span>
      </div>
      <div className="filt-summary">
        <div className="row"><span className="k">найдено</span><span className="v">{f.found}</span></div>
        <div className="row"><span className="k">приток</span><span className="v pos">{f.inflow}</span></div>
        <div className="row"><span className="k">отток</span><span className="v info">{f.outflow}</span></div>
        <div className="row"><span className="k">переводы</span><span className="v warn">{f.transfers}</span></div>
        <div className="row"><span className="k">компенсации</span><span className="v warn">{f.reimburse}</span></div>
        <div className="row"><span className="k">ср / день</span><span className="v">{f.avgPerDay}</span></div>
      </div>
    </div>
  );
}

export default function TransactionsSummary() {
  return (
    <SummaryShell>
      <SafeUntilBlock />
      <FilterBlock />
      <AvailableBlock />
      <BalancesBlock />
      <SessionStateBlock
        rows={[
          { tone: "pos", k: "режим", v: "норма", vClass: "pos" },
          { tone: "muted", k: "вид", v: "лента" },
          { tone: "warn", k: "ожидание", v: "2 плановых", vClass: "warn" },
        ]}
      />
      <QuickButtons />
    </SummaryShell>
  );
}
