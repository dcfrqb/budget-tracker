import { LiveClock } from "./live-clock";
import { TopBarCrumbs } from "./top-bar-crumbs";
import { getLatestRatesWithMeta, ensureFreshRates } from "@/lib/data/wallet";
import { getHomeDashboard } from "@/lib/data/dashboard";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { formatRate } from "@/lib/format/money";
import { getT, getLocale } from "@/lib/i18n/server";
import { getConnectedCredentials } from "@/lib/data/_queries/integrations";
import { SyncButton } from "./sync-button";
import { formatAgo } from "@/lib/fx/freshness";

export async function TopBar() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);

  const STATUS_LABELS: Record<string, string> = {
    stable:  t("shell.status.stable"),
    warning: t("shell.status.warning"),
    crisis:  t("shell.status.crisis"),
  };

  const userId = await getCurrentUserId();

  // Ensure rates are fresh (CBR safety net, 6h window) before reading from DB.
  await ensureFreshRates();

  const [rates, dashboard, rawCredentials] = await Promise.all([
    getLatestRatesWithMeta(),
    getHomeDashboard(userId, DEFAULT_CURRENCY),
    getConnectedCredentials(userId),
  ]);

  const syncCredentials = rawCredentials.map((c) => ({
    id: c.id,
    adapterId: c.adapterId,
    displayLabel: c.displayLabel,
    lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
    lastErrorAt: c.lastErrorAt?.toISOString() ?? null,
  }));

  const usdRub = rates.get("USD-RUB");
  const eurRub = rates.get("EUR-RUB");

  const latestRatesRecordedAt =
    usdRub && eurRub
      ? new Date(Math.max(usdRub.recordedAt.getTime(), eurRub.recordedAt.getTime()))
      : (usdRub?.recordedAt ?? eurRub?.recordedAt ?? null);

  const ratesTitle = latestRatesRecordedAt
    ? formatAgo(latestRatesRecordedAt, locale)
    : null;

  const statusLabel = STATUS_LABELS[dashboard.status] ?? t("shell.status.stable");

  return (
    <div className="topbar">
      <span className="brand mono">{t("shell.brand")}</span>
      <TopBarCrumbs />
      <span className="pill">
        <span className="pulse" aria-hidden />
        {statusLabel}
      </span>
      <div className="right">
        {(usdRub || eurRub) && (
          <span className="mono" title={ratesTitle ?? undefined}>
            {usdRub && <>USD/RUB <b style={{ color: "var(--muted)" }}>{formatRate(usdRub.rate)}</b></>}
            {usdRub && eurRub && " · "}
            {eurRub && <>EUR/RUB <b style={{ color: "var(--muted)" }}>{formatRate(eurRub.rate)}</b></>}
          </span>
        )}
        <LiveClock />
        <SyncButton credentials={syncCredentials} locale={locale} />
      </div>
    </div>
  );
}
