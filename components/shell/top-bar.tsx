import { LiveClock } from "./live-clock";
import { TopBarCrumbs } from "./top-bar-crumbs";
import { getLatestRatesMap, ensureFreshRates } from "@/lib/data/wallet";
import { getHomeDashboard } from "@/lib/data/dashboard";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { formatRate } from "@/lib/format/money";
import { getT } from "@/lib/i18n/server";

export async function TopBar() {
  const t = await getT();

  const STATUS_LABELS: Record<string, string> = {
    stable:  t("shell.status.stable"),
    warning: t("shell.status.warning"),
    crisis:  t("shell.status.crisis"),
  };

  const userId = await getCurrentUserId();

  // Ensure rates are fresh (CBR, max 10 min stale) before reading from DB.
  await ensureFreshRates();

  const [rates, dashboard] = await Promise.all([
    getLatestRatesMap(),
    getHomeDashboard(userId, DEFAULT_CURRENCY),
  ]);

  const usdRub = rates.get("USD-RUB");
  const eurRub = rates.get("EUR-RUB");

  const statusLabel = STATUS_LABELS[dashboard.status] ?? t("shell.status.stable");

  return (
    <div className="topbar">
      <span className="brand mono">БДЖ://</span>
      <TopBarCrumbs />
      <span className="pill">
        <span className="pulse" aria-hidden />
        {statusLabel}
      </span>
      <div className="right">
        {(usdRub || eurRub) && (
          <span className="mono">
            {usdRub && <>USD/RUB <b style={{ color: "var(--muted)" }}>{formatRate(usdRub)}</b></>}
            {usdRub && eurRub && " · "}
            {eurRub && <>EUR/RUB <b style={{ color: "var(--muted)" }}>{formatRate(eurRub)}</b></>}
          </span>
        )}
        <LiveClock />
        <span className="kbd">⌘K</span>
      </div>
    </div>
  );
}
