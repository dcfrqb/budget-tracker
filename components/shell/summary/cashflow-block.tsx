import { Sparkline } from "@/components/shell/sparkline";
import { CASHFLOW_30D, CASHFLOW_DELTA_LABEL } from "@/lib/mock";

export function CashflowBlock() {
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>денежный поток 30д</span>
        <span className="tiny">стабильно-плюс</span>
      </div>
      <Sparkline points={CASHFLOW_30D} />
      <div
        className="mono"
        style={{
          fontSize: 10,
          color: "var(--muted)",
          marginTop: 4,
          letterSpacing: ".1em",
        }}
      >
        ▁▂▃▃▅▇▇ {CASHFLOW_DELTA_LABEL}
      </div>
    </div>
  );
}
