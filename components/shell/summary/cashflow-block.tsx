import { getT } from "@/lib/i18n/server";
import { Sparkline } from "@/components/shell/sparkline";
import { getCashflow30dDailyNet } from "@/lib/data/dashboard";
import { getCurrentUserId } from "@/lib/api/auth";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { formatRubPrefix } from "@/lib/format/money";
import { Prisma } from "@prisma/client";

export async function CashflowBlock({ points, deltaLabel }: { points?: number[]; deltaLabel?: string }) {
  const t = await getT();

  let data: number[];
  if (points !== undefined) {
    data = points;
  } else {
    const userId = await getCurrentUserId();
    data = await getCashflow30dDailyNet(userId, DEFAULT_CURRENCY);
  }

  const hasData = data.some((v) => v !== 0);

  let resolvedDeltaLabel = deltaLabel;
  if (resolvedDeltaLabel === undefined && hasData) {
    const last7 = data.slice(-7).reduce((s, v) => s + v, 0);
    const prev7 = data.slice(-14, -7).reduce((s, v) => s + v, 0);
    const diff = last7 - prev7;
    const absDiff = new Prisma.Decimal(Math.abs(diff));
    if (diff >= 0) {
      resolvedDeltaLabel = t("summary.home.cashflow.delta_pos", { vars: { amount: formatRubPrefix(absDiff) } });
    } else {
      resolvedDeltaLabel = t("summary.home.cashflow.delta_neg", { vars: { amount: formatRubPrefix(absDiff) } });
    }
  }

  // Normalize to [0..1] for sparkline
  let normalized: number[] = [];
  if (hasData) {
    const min = Math.min(...data);
    const max = Math.max(...data);
    if (min === max) {
      normalized = data.map(() => 0.5);
    } else {
      normalized = data.map((v) => (v - min) / (max - min));
    }
  }

  return (
    <div className="sum-block">
      <div className="lbl">
        <span>{t("shell.summary.cashflow.title")}</span>
        <span className="tiny">{t("shell.summary.cashflow.period_label")}</span>
      </div>
      {hasData ? (
        <>
          <Sparkline points={normalized} />
          {resolvedDeltaLabel && (
            <div
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--muted)",
                marginTop: 4,
                letterSpacing: ".1em",
              }}
            >
              {resolvedDeltaLabel}
            </div>
          )}
        </>
      ) : (
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
          {t("shell.summary.cashflow.empty")}
        </div>
      )}
    </div>
  );
}
