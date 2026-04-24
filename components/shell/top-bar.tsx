import { LiveClock } from "./live-clock";
import { TopBarCrumbs } from "./top-bar-crumbs";
import { getLatestRatesMap } from "@/lib/data/wallet";
import { getHomeDashboard } from "@/lib/data/dashboard";
import { DEFAULT_USER_ID, DEFAULT_CURRENCY } from "@/lib/constants";
import { Prisma } from "@prisma/client";
import { formatRate } from "@/lib/format/money";

const STATUS_LABELS: Record<string, string> = {
  stable: "СТАБИЛЬНО",
  warning: "ВНИМАНИЕ",
  crisis: "КРИЗИС",
};

export async function TopBar() {
  const [rates, dashboard] = await Promise.all([
    getLatestRatesMap(),
    getHomeDashboard(DEFAULT_USER_ID, DEFAULT_CURRENCY),
  ]);

  const usdRub = rates.get("USD-RUB");
  const eurRub = rates.get("EUR-RUB");

  const statusLabel = STATUS_LABELS[dashboard.status] ?? "СТАБИЛЬНО";

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
