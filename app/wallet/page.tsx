import { AddAccountCta } from "@/components/wallet/add-cta";
import { Archive } from "@/components/wallet/archive";
import { CashStashSection } from "@/components/wallet/cash-stash";
import { FxRates } from "@/components/wallet/fx-rates";
import { Institutions } from "@/components/wallet/institutions";
import { WalletStatusStrip } from "@/components/wallet/status-strip";
import { WalletTotals } from "@/components/wallet/totals";
import { DEFAULT_CURRENCY, DEFAULT_USER_ID } from "@/lib/constants";
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
  const [institutions, cashAccounts, archivedAccounts, fxRows, totals, rates] =
    await Promise.all([
      getInstitutionsWithAccounts(DEFAULT_USER_ID),
      getCashStash(DEFAULT_USER_ID),
      getArchivedAccounts(DEFAULT_USER_ID),
      getFxRates(),
      getWalletTotals(DEFAULT_USER_ID, DEFAULT_CURRENCY),
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
  const cashMeta = `${cashAccounts.length} локаций · ${cashCcyCount} валют`;

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
