import { AddAccountCta } from "@/components/wallet/add-cta";
import { Archive } from "@/components/wallet/archive";
import { CashStashSection } from "@/components/wallet/cash-stash";
import { FxRates } from "@/components/wallet/fx-rates";
import { Institutions } from "@/components/wallet/institutions";
import { WalletStatusStrip, type WalletGroup } from "@/components/wallet/status-strip";
import { WalletTotals } from "@/components/wallet/totals";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { getLocale, getT } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import {
  getArchivedAccounts,
  getCashStash,
  getFxRates,
  getInstitutionsWithAccounts,
  getLatestRatesMap,
  getWalletTotals,
  type InstitutionWithAccounts,
  type AccountWithCurrency,
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

// ── Filter helpers ──────────────────────────────────────────────────────────

function filterInstitutionsByGroup(
  institutions: InstitutionWithAccounts[],
  group: WalletGroup,
): InstitutionWithAccounts[] {
  if (group === "all" || group === "cash" || group === "arch") return institutions;
  if (group === "banks") return institutions.filter((i) => i.kind === "BANK");
  if (group === "crypto") return institutions.filter((i) => i.kind === "CRYPTO");
  return institutions;
}

function filterAccountsByCcy<T extends { currencyCode: string }>(
  accounts: T[],
  ccy: string,
): T[] {
  if (ccy === "all") return accounts;
  return accounts.filter((a) => a.currencyCode === ccy);
}

function filterInstitutionsByCcy(
  institutions: InstitutionWithAccounts[],
  ccy: string,
): InstitutionWithAccounts[] {
  if (ccy === "all") return institutions;
  return institutions
    .map((inst) => ({
      ...inst,
      accounts: inst.accounts.filter((a) => a.currencyCode === ccy),
    }))
    .filter((inst) => inst.accounts.length > 0);
}

// ── Collect unique currencies from all accounts ────────────────────────────

function collectCurrencies(
  institutions: InstitutionWithAccounts[],
  cashAccounts: AccountWithCurrency[],
  archivedAccounts: AccountWithCurrency[],
): string[] {
  const codes = new Set<string>();
  for (const inst of institutions) {
    for (const acc of inst.accounts) codes.add(acc.currencyCode);
  }
  for (const acc of cashAccounts) codes.add(acc.currencyCode);
  for (const acc of archivedAccounts) codes.add(acc.currencyCode);
  return [...codes].sort();
}

// ── Month / day progress helpers ───────────────────────────────────────────

function buildMonthLabel(locale: string): string {
  const now = new Date();
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", {
    month: "short",
    year: "numeric",
  }).format(now);
}

function buildDayProgress(dayKey: string): string {
  const now = new Date();
  const day = now.getDate();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return dayKey.replace("{day}", String(day)).replace("{days}", String(days));
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; ccy?: string }>;
}) {
  const [userId, t, locale, params] = await Promise.all([
    getCurrentUserId(),
    getT(),
    getLocale(),
    searchParams,
  ]);

  // Parse filter params
  const rawGroup = params.group;
  const group: WalletGroup =
    rawGroup === "banks" ||
    rawGroup === "crypto" ||
    rawGroup === "cash" ||
    rawGroup === "arch"
      ? rawGroup
      : "all";
  const ccy = typeof params.ccy === "string" && params.ccy !== "" ? params.ccy : "all";

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

  // ── Build strip props (before filtering so currencies reflect full set) ──
  const stripCurrencies = collectCurrencies(institutions, cashAccounts, archivedAccounts);
  const monthLabel = buildMonthLabel(locale);
  const dayProgress = buildDayProgress(t("wallet.strip.day_progress"));

  // ── Apply filters ─────────────────────────────────────────────────────────
  const filteredInstitutions = filterInstitutionsByCcy(
    filterInstitutionsByGroup(institutions, group),
    ccy,
  );
  const filteredCash = filterAccountsByCcy(cashAccounts, ccy);
  const filteredArchived = filterAccountsByCcy(archivedAccounts, ccy);

  // Decide visibility of sections based on group
  const showInstitutions = group === "all" || group === "banks" || group === "crypto";
  const showCash = group === "all" || group === "cash";
  const showAddAccountCta = group === "all" || group === "banks" || group === "crypto";
  const showArchive = group === "all" || group === "arch";

  // ── Views ────────────────────────────────────────────────────────────────
  const totalsView = toWalletTotalsView(totals, t);
  const fxView = fxRows.map(toFxRateView);

  // Latest recordedAt across all displayed FX rows (for freshness indicator).
  const fxLatestRecordedAt =
    fxRows.length > 0
      ? fxRows.reduce<Date>(
          (max, r) => (r.recordedAt > max ? r.recordedAt : max),
          fxRows[0].recordedAt,
        )
      : null;
  const instViews = filteredInstitutions.map((i) =>
    toInstitutionView(i, rates, DEFAULT_CURRENCY, locale),
  );
  const cashView = filteredCash.map((a) =>
    toCashStashView(a, rates, DEFAULT_CURRENCY),
  );
  const archivedView = filteredArchived.map(toArchivedView);

  const cashCcyCount = new Set(filteredCash.map((a) => a.currencyCode)).size;
  const cashMeta = t("wallet.cash_meta", {
    vars: {
      locations: String(filteredCash.length),
      currencies: String(cashCcyCount),
    },
  });

  const currencyOptions = currencies.map((c) => ({ code: c.code, symbol: c.symbol }));

  return (
    <>
      <WalletStatusStrip
        currencies={stripCurrencies}
        monthLabel={monthLabel}
        dayProgress={dayProgress}
      />
      <WalletTotals totals={totalsView} />
      <FxRates
        rates={fxView}
        currencies={currencyOptions}
        cbrAvailableCodes={cbrAvailableCodes}
        latestRecordedAt={fxLatestRecordedAt}
      />
      {showInstitutions && <Institutions institutions={instViews} />}
      {showAddAccountCta && <AddAccountCta />}
      {showCash && (
        <CashStashSection
          stash={cashView}
          meta={cashMeta}
          currencies={currencyOptions}
          primaryCurrency={primaryCurrency}
        />
      )}
      {showArchive && <Archive items={archivedView} />}
    </>
  );
}
