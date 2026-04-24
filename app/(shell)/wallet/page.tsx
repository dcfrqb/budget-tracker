import { AddAccountCta } from "@/components/wallet/add-cta";
import { Archive } from "@/components/wallet/archive";
import { CashStashSection } from "@/components/wallet/cash-stash";
import { FxRates } from "@/components/wallet/fx-rates";
import { Institutions } from "@/components/wallet/institutions";
import { WalletStatusStrip } from "@/components/wallet/status-strip";
import { WalletTotals } from "@/components/wallet/totals";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { getT } from "@/lib/i18n/server";
import {
  getArchivedAccounts,
  getCashStash,
  getFxRates,
  getInstitutionsWithAccounts,
  getLatestRatesMap,
  getWalletTotals,
} from "@/lib/data/wallet";
import {
  toArchivedView,
  toCashStashView,
  toFxRateView,
  toInstitutionView,
  toWalletTotalsView,
} from "@/lib/view/wallet";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);
  const [institutions, cashAccounts, archivedAccounts, fxRows, totals, rates] =
    await Promise.all([
      getInstitutionsWithAccounts(userId),
      getCashStash(userId),
      getArchivedAccounts(userId),
      getFxRates(),
      getWalletTotals(userId, DEFAULT_CURRENCY),
      getLatestRatesMap(),
    ]);

  const totalsView = toWalletTotalsView(totals);
  const fxView = fxRows.map(toFxRateView);
  const instViews = institutions.map((i) =>
    toInstitutionView(i, rates, DEFAULT_CURRENCY, totals.net.valueBase),
  );

  const cashView = cashAccounts.map((a) =>
    toCashStashView(a, rates, DEFAULT_CURRENCY),
  );
  const archivedView = archivedAccounts.map(toArchivedView);

  const cashCcyCount = new Set(cashAccounts.map((a) => a.currencyCode)).size;
  const cashMeta = t("wallet.cash_meta", { vars: { locations: String(cashAccounts.length), currencies: String(cashCcyCount) } });

  return (
    <>
      <WalletStatusStrip />
      <WalletTotals totals={totalsView} />
      <FxRates rates={fxView} />
      <Institutions institutions={instViews} />
      <CashStashSection stash={cashView} meta={cashMeta} />
      <AddAccountCta />
      <Archive items={archivedView} />
    </>
  );
}
