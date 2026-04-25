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
import { db } from "@/lib/db";
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
import { fetchCbrRates, getCbrAvailableCodes } from "@/lib/fx/cbr-fetcher";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const [userId, t] = await Promise.all([getCurrentUserId(), getT()]);
  const [institutions, cashAccounts, archivedAccounts, totals, rates, currencies, budgetSettings] =
    await Promise.all([
      getInstitutionsWithAccounts(userId),
      getCashStash(userId),
      getArchivedAccounts(userId),
      getWalletTotals(userId, DEFAULT_CURRENCY),
      getLatestRatesMap(),
      db.currency.findMany({ orderBy: { code: "asc" } }),
      db.budgetSettings.findUnique({
        where: { userId },
        select: { primaryCurrencyCode: true, shownFxPairs: true },
      }),
    ]);

  const shownFxPairs = budgetSettings?.shownFxPairs ?? [];
  const primaryCurrency = budgetSettings?.primaryCurrencyCode ?? DEFAULT_CURRENCY;

  // Fetch FX rates (CBR + DB fallback) using shownFxPairs setting
  const fxRows = await getFxRates(shownFxPairs);

  // Get CBR-available codes for the add-pair dialog (disable unsupported currencies)
  let cbrAvailableCodes: string[] = [];
  try {
    const cbrRates = await fetchCbrRates();
    cbrAvailableCodes = [...getCbrAvailableCodes(cbrRates)];
  } catch {
    // If CBR is unreachable, allow all currencies in dialog (no disable)
    cbrAvailableCodes = currencies.map((c) => c.code);
  }

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
  const cashMeta = t("wallet.cash_meta", {
    vars: {
      locations: String(cashAccounts.length),
      currencies: String(cashCcyCount),
    },
  });

  const currencyOptions = currencies.map((c) => ({ code: c.code, symbol: c.symbol }));

  return (
    <>
      <WalletStatusStrip />
      <WalletTotals totals={totalsView} />
      <FxRates
        rates={fxView}
        currencies={currencyOptions}
        cbrAvailableCodes={cbrAvailableCodes}
      />
      <Institutions institutions={instViews} />
      <AddAccountCta />
      <CashStashSection
        stash={cashView}
        meta={cashMeta}
        currencies={currencyOptions}
        primaryCurrency={primaryCurrency}
      />
      <Archive items={archivedView} />
    </>
  );
}
