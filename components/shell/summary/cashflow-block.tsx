import { Sparkline } from "@/components/shell/sparkline";

// TODO: заменить заглушку когда появятся исторические точки cashflow
const CASHFLOW_STUB: number[] = [];

export function CashflowBlock({ points, deltaLabel }: { points?: number[]; deltaLabel?: string }) {
  const data = points ?? CASHFLOW_STUB;
  return (
    <div className="sum-block">
      <div className="lbl">
        <span>денежный поток 30д</span>
        <span className="tiny">текущий период</span>
      </div>
      {data.length > 0 ? (
        <>
          <Sparkline points={data} />
          {deltaLabel && (
            <div
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--muted)",
                marginTop: 4,
                letterSpacing: ".1em",
              }}
            >
              {deltaLabel}
            </div>
          )}
        </>
      ) : (
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
          нет данных
        </div>
      )}
    </div>
  );
}
