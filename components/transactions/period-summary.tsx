import { CountUp } from "@/components/count-up";
import { TXN_PERIOD_SUMMARY } from "@/lib/mock-transactions";

export function PeriodSummary() {
  const { inflow, outflow, transfers, net } = TXN_PERIOD_SUMMARY;

  return (
    <div className="section fade-in" style={{ animationDelay: "120ms" }}>
      <div className="section-hd">
        <div className="ttl mono">
          <b>сводка периода</b> <span className="dim">· 30д</span>
        </div>
        <div className="meta mono">
          {inflow.count + outflow.count + transfers.count} транз. · 2 план · 1 частично
        </div>
      </div>
      <div className="section-body flush">
        <div className="period-grid">
          <div className="period-cell">
            <div className="code inflow">ПРИТОК</div>
            <div className="val inflow">
              +₽ <CountUp to={inflow.value} />
            </div>
            <div className="meta">{inflow.count} транз. · {inflow.avg}</div>
          </div>
          <div className="period-cell">
            <div className="code outflow">ОТТОК</div>
            <div className="val outflow">
              −₽ <CountUp to={outflow.value} />
            </div>
            <div className="meta">{outflow.count} транз. · {outflow.avg}</div>
          </div>
          <div className="period-cell">
            <div className="code xfr">ПЕРЕВОДЫ</div>
            <div className="val xfr">
              ₽ <CountUp to={transfers.value} />
            </div>
            <div className="meta">{transfers.count} транз. · {transfers.avg}</div>
          </div>
          <div className="period-cell">
            <div className="code net">НЕТТО</div>
            <div className="val net">
              +₽ <CountUp to={net.value} />
            </div>
            <div className="meta">{net.note}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
