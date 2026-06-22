import React from "react";
import { AddAccountCta } from "@/components/wallet/add-cta";
import { Archive } from "@/components/wallet/archive";
import { CashStashSection } from "@/components/wallet/cash-stash";
import { CashEditHost } from "@/components/wallet/cash-edit-host";
import { AccountSheetHost } from "@/components/wallet/account-sheet-host";
import { FxRates } from "@/components/wallet/fx-rates";
import { Institutions } from "@/components/wallet/institutions";
import { WalletStatusStrip, type WalletGroup } from "@/components/wallet/status-strip";
import { WalletTotals } from "@/components/wallet/totals";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/api/auth";
import { getLocale, getT } from "@/lib/i18n/server";
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
import { listAllCurrencies } from "@/lib/data/currencies";
import { getBudgetSettings } from "@/lib/data/settings";
import { db } from "@/lib/db";
import { AccountKind } from "@prisma/client";
import {
  toArchivedView,
  toCashStashView,
  toFxRateView,
  toInstitutionView,
  toWalletTotalsView,
} from "@/lib/view/wallet";
import { fetchCbrRates, getCbrAvailableCodes } from "@/lib/fx/cbr-fetcher";
import { pluralRu, pluralEn } from "@/lib/i18n/plural";
import { ruPluralForms } from "@/lib/i18n/locales/ru";
import { enPluralForms } from "@/lib/i18n/locales/en";

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
  searchParams: Promise<{ group?: string; ccy?: string; edit?: string; new?: string }>;
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
      listAllCurrencies(),
      getBudgetSettings(userId),
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
  const totalsView = toWalletTotalsView(totals, t, locale);
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
    toInstitutionView(i, rates, DEFAULT_CURRENCY, locale, t),
  );
  const cashView = filteredCash.map((a) =>
    toCashStashView(a, rates, DEFAULT_CURRENCY),
  );
  const archivedView = filteredArchived.map((a) => toArchivedView(a, t, locale));

  const cashCcyCount = new Set(filteredCash.map((a) => a.currencyCode)).size;
  const locWord = locale === "ru"
    ? pluralRu(filteredCash.length, ruPluralForms.locations)
    : pluralEn(filteredCash.length, ...enPluralForms.locations);
  const curWord = locale === "ru"
    ? pluralRu(cashCcyCount, ruPluralForms.currencies)
    : pluralEn(cashCcyCount, ...enPluralForms.currencies);
  const cashMeta = t("wallet.cash_meta", {
    vars: {
      locations: String(filteredCash.length),
      currencies: String(cashCcyCount),
      locWord,
      curWord,
    },
  });

  const currencyOptions = currencies.map((c) => ({ code: c.code, symbol: c.symbol }));

  // Lazy-fetch cash account only when ?edit=cash:<id> is present
  let cashEditHostNode: React.ReactNode = null;
  const editParam = params.edit;
  if (editParam) {
    const colonIdx = editParam.indexOf(":");
    const editKind = colonIdx > 0 ? editParam.slice(0, colonIdx) : null;
    const editId = colonIdx > 0 ? editParam.slice(colonIdx + 1) : null;

    if (editKind === "cash" && editId) {
      const [cashAccount, cashCurrencies] = await Promise.all([
        db.account.findFirst({
          where: { id: editId, userId, kind: AccountKind.CASH, deletedAt: null },
          select: {
            id: true,
            location: true,
            currencyCode: true,
            balance: true,
            includeInAnalytics: true,
          },
        }),
        listAllCurrencies(),
      ]);

      if (cashAccount) {
        cashEditHostNode = (
          <CashEditHost
            cashId={cashAccount.id}
            initialLocation={cashAccount.location ?? ""}
            initialCurrency={cashAccount.currencyCode}
            initialBalance={cashAccount.balance.toString()}
            initialIncludeInAnalytics={cashAccount.includeInAnalytics}
            currencies={cashCurrencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
          />
        );
      }
    }
  }

  // Lazy-fetch account only when ?new=account or ?edit=account:<id> is present
  let accountSheetNode: React.ReactNode = null;
  const newParam = params.new;
  const isAccountCreate = newParam === "account";
  const isAccountEdit = typeof editParam === "string" && editParam.startsWith("account:");

  if (isAccountCreate || isAccountEdit) {
    const editAccountId = isAccountEdit ? editParam.slice("account:".length) : null;
    const [acctCurrencies, acctInstitutions, editAccount] = await Promise.all([
      listAllCurrencies(),
      db.institution.findMany({
        where: { userId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, kind: true },
      }),
      editAccountId
        ? db.account.findFirst({
            where: { id: editAccountId, userId, deletedAt: null },
            select: {
              id: true,
              institutionId: true,
              kind: true,
              name: true,
              currencyCode: true,
              balance: true,
              sub: true,
              sortOrder: true,
              includeInAnalytics: true,
              creditRatePct: true,
              creditLimit: true,
              gracePeriodDays: true,
              statementDay: true,
              minPaymentPercent: true,
              minPaymentFixed: true,
              annualRatePct: true,
              savingsCapitalization: true,
              withdrawalLimit: true,
              cardLast4: true,
              accountNumber: true,
              bic: true,
              bankName: true,
            },
          })
        : Promise.resolve(null),
    ]);

    const acctInitialValues = editAccount
      ? {
          institutionId: editAccount.institutionId ?? undefined,
          kind: editAccount.kind,
          name: editAccount.name,
          currencyCode: editAccount.currencyCode,
          balance:
            editAccount.kind === "CREDIT" && editAccount.creditLimit != null
              ? editAccount.creditLimit.plus(editAccount.balance).toString()
              : editAccount.balance.toString(),
          sub: editAccount.sub ?? undefined,
          sortOrder: editAccount.sortOrder,
          includeInAnalytics: editAccount.includeInAnalytics,
          creditRatePct: editAccount.creditRatePct?.toString() ?? undefined,
          creditLimit: editAccount.creditLimit?.toString() ?? undefined,
          gracePeriodDays: editAccount.gracePeriodDays ?? undefined,
          statementDay: editAccount.statementDay ?? undefined,
          minPaymentPercent: editAccount.minPaymentPercent?.toString() ?? undefined,
          minPaymentFixed: editAccount.minPaymentFixed?.toString() ?? undefined,
          annualRatePct: editAccount.annualRatePct?.toString() ?? undefined,
          savingsCapitalization: editAccount.savingsCapitalization ?? undefined,
          withdrawalLimit: editAccount.withdrawalLimit?.toString() ?? undefined,
          cardLast4: editAccount.cardLast4 ?? [],
          accountNumber: editAccount.accountNumber ?? "",
          bic: editAccount.bic ?? "",
          bankName: editAccount.bankName ?? "",
        }
      : undefined;

    accountSheetNode = (
      <AccountSheetHost
        currencies={acctCurrencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        institutions={acctInstitutions.map((i) => ({ id: i.id, name: i.name, kind: i.kind }))}
        primaryCurrency={primaryCurrency}
        accountId={editAccountId ?? undefined}
        initialValues={acctInitialValues}
      />
    );
  }

  return (
    <>
      <WalletStatusStrip
        currencies={stripCurrencies}
        monthLabel={monthLabel}
        dayProgress={dayProgress}
      />
      <WalletTotals totals={totalsView} latestRecordedAt={fxLatestRecordedAt} />
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
      {cashEditHostNode}
      {accountSheetNode}
    </>
  );
}
