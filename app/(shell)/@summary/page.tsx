import {
  AvailableBlock,
  BalancesBlock,
  QuickButtons,
  SafeUntilBlock,
  SessionStateBlock,
  SummaryShell,
} from "@/components/shell/summary/common";
import { CashflowBlock } from "@/components/shell/summary/cashflow-block";
import { getHomeDashboard } from "@/lib/data/dashboard";
import { toHomeView } from "@/lib/view/home";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function HomeSummary() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);
  const dashboard = await getHomeDashboard(userId, DEFAULT_CURRENCY);
  const view = toHomeView(dashboard, t);

  const modeLabels: Record<string, string> = {
    ECONOMY: t("summary.home.mode_economy"),
    NORMAL: t("summary.home.mode_normal"),
    FREE: t("summary.home.mode_free"),
  };

  // status label comes from view layer data, not UI strings — no i18n needed here
  // but we still use it to derive tone
  const statusToneMap: Record<string, "pos" | "warn" | "neg"> = {
    "\u0421\u0422\u0410\u0411\u0418\u041b\u042c\u041d\u041e": "pos",
    "\u0412\u041d\u0418\u041c\u0410\u041d\u0418\u0415": "warn",
    "\u041a\u0420\u0418\u0417\u0418\u0421": "neg",
  };
  void statusToneMap;

  return (
    <SummaryShell>
      <SafeUntilBlock data={{ days: view.safeUntil.days }} />
      <AvailableBlock data={view.available} />
      <BalancesBlock balances={view.balances} />
      <CashflowBlock />
      <SessionStateBlock
        status={{ label: view.status.label }}
        rows={[
          { tone: "pos", k: t("summary.home.mode_key"), v: modeLabels[view.budgetMode] ?? t("summary.home.mode_normal") },
          { tone: "muted", k: t("summary.home.period_key"), v: t("summary.home.period_val") },
        ]}
      />
      <QuickButtons />
    </SummaryShell>
  );
}
