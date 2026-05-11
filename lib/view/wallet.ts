import { Prisma } from "@prisma/client";
import type { AccountKind } from "@prisma/client";
import { formatMoney } from "@/lib/format/money";
import { formatRelative } from "@/lib/format/relative-time";
import type { Locale, TOptions } from "@/lib/i18n/types";
import type { TKey } from "@/lib/i18n/t";
import { pluralRu, pluralEn } from "@/lib/i18n/plural";
import { ruPluralForms } from "@/lib/i18n/locales/ru";
import { enPluralForms } from "@/lib/i18n/locales/en";
import { convertToBase, resolveCreditState } from "@/lib/data/wallet";
import type {
  AccountWithCurrency,
  FxRateRow,
  InstitutionWithAccounts,
  WalletTotals,
} from "@/lib/data/wallet";

type TFn = (key: TKey, options?: TOptions) => string;

// ─────────────────────────────────────────────
// ACCOUNT VIEW
// ─────────────────────────────────────────────

export type AccountView = {
  id: string;
  kind: string;            // lowercase for CSS ("card", "savings", …)
  icon: string;
  name: string;
  sub: string;
  kindLabel: string;
  ccy: string;
  colPill: string;
  value: string;
  updated: string;
  excludedFromAnalytics: boolean;
  // CREDIT-specific display fields (only set when kind === "CREDIT")
  creditDebt?: string;
  creditAvailable?: string;
  creditLimit?: string;
  creditNoLimit?: boolean;
};

function kindLabelKey(kind: AccountKind): TKey {
  const map: Record<AccountKind, TKey> = {
    CARD: "wallet.kind.card",
    CREDIT: "wallet.kind.credit",
    SAVINGS: "wallet.kind.savings",
    CASH: "wallet.kind.cash",
    CRYPTO: "wallet.kind.crypto",
    LOAN: "wallet.kind.loan",
  };
  return map[kind];
}

function colPillKey(kind: AccountKind): TKey {
  const map: Record<AccountKind, TKey> = {
    CARD: "wallet.collateral.card",
    CREDIT: "wallet.collateral.credit",
    SAVINGS: "wallet.collateral.savings",
    CASH: "wallet.collateral.cash",
    CRYPTO: "wallet.collateral.crypto",
    LOAN: "wallet.collateral.loan",
  };
  return map[kind];
}

function firstLetter(s: string): string {
  return s.trim().charAt(0).toUpperCase() || "?";
}

// For crypto: cold-wallet → "Hardware" (loanword, same in all locales), exchange → wallet.kind.crypto
function cryptoKindLabelFromSubtype(subtype: string | null, t: TFn): string {
  return subtype === "cold-wallet" ? "Hardware" : t("wallet.kind.crypto");
}

function approxRubString(
  amount: Prisma.Decimal | string | number,
  fromCcy: string,
  baseCcy: string,
  rates: Map<string, Prisma.Decimal>,
): string | null {
  const inBase = convertToBase(amount, fromCcy, baseCcy, rates);
  if (!inBase) return null;
  return formatMoney(new Prisma.Decimal(inBase.toFixed(0)), baseCcy, { approx: true });
}

export function toAccountView(
  a: AccountWithCurrency,
  rates: Map<string, Prisma.Decimal>,
  baseCcy: string,
  locale: Locale = "ru",
  t: TFn,
): AccountView {
  const value = formatMoney(a.balance, a.currencyCode);

  // Build updated from 2 parts: "≈ N ₽" (for foreign-ccy) + "upd N min" (if balance was touched).
  const parts: string[] = [];
  if (a.currencyCode !== baseCcy) {
    const approx = approxRubString(a.balance, a.currencyCode, baseCcy, rates);
    if (approx) parts.push(approx);
  }
  if (a.balanceUpdatedAt) {
    parts.push(t("wallet.account.refreshed_ago", { vars: { ago: formatRelative(a.balanceUpdatedAt, locale) } }));
  }
  const updated = parts.length > 0 ? parts.join(" · ") : t("wallet.account.refreshed");

  const kindLabel =
    a.kind === "CRYPTO"
      ? cryptoKindLabelFromSubtype(a.subtype, t)
      : t(kindLabelKey(a.kind));

  const colPill = a.customPillLabel ?? t(colPillKey(a.kind));

  // CREDIT-specific fields
  let creditDebt: string | undefined;
  let creditAvailable: string | undefined;
  let creditLimit: string | undefined;
  let creditNoLimit: boolean | undefined;

  if (a.kind === "CREDIT") {
    const state = resolveCreditState(a);
    creditDebt = formatMoney(state.debt, a.currencyCode);
    creditAvailable = formatMoney(state.available, a.currencyCode);
    creditLimit = state.hasLimit ? formatMoney(state.limit!, a.currencyCode) : undefined;
    creditNoLimit = !state.hasLimit;
  }

  return {
    id: a.id,
    kind: a.kind.toLowerCase(),
    icon: firstLetter(a.name),
    name: a.name,
    sub: a.sub ?? "",
    kindLabel,
    ccy: a.currencyCode,
    colPill,
    value,
    updated,
    excludedFromAnalytics: !a.includeInAnalytics,
    creditDebt,
    creditAvailable,
    creditLimit,
    creditNoLimit,
  };
}

// ─────────────────────────────────────────────
// INSTITUTION VIEW
// ─────────────────────────────────────────────

export type InstitutionView = {
  id: string;
  logo: string;
  letter: string;
  name: string;
  sub: string;
  accounts: AccountView[];
};

const KNOWN_LOGOS = new Set([
  "tinkoff",
  "sber",
  "alfa",
  "binance",
  "ledger",
  "cash",
]);

export function toInstitutionView(
  inst: InstitutionWithAccounts,
  rates: Map<string, Prisma.Decimal>,
  baseCcy: string,
  locale: Locale = "ru",
  t: TFn,
): InstitutionView {
  const accounts = inst.accounts.map((a) => toAccountView(a, rates, baseCcy, locale, t));

  const logo =
    inst.logo && KNOWN_LOGOS.has(inst.logo) ? inst.logo : "default";

  return {
    id: inst.id,
    logo,
    letter: firstLetter(inst.name),
    name: inst.name,
    sub: inst.sub ?? "",
    accounts,
  };
}

// ─────────────────────────────────────────────
// CASH STASH VIEW
// ─────────────────────────────────────────────

export type CashStashView = {
  id: string;
  sym: string;
  loc: string;
  value: string;
  sub: string;
};

export function toCashStashView(
  a: AccountWithCurrency,
  rates: Map<string, Prisma.Decimal>,
  baseCcy: string,
): CashStashView {
  const value = formatMoney(a.balance, a.currencyCode);
  let sub = a.sub ?? "";
  if (a.currencyCode !== baseCcy) {
    const inBase = convertToBase(a.balance, a.currencyCode, baseCcy, rates);
    if (inBase) {
      const rounded = new Prisma.Decimal(inBase.toFixed(0));
      const approx = formatMoney(rounded, baseCcy, { approx: true });
      sub = `${approx}${sub ? " · " + sub : ""}`;
    }
  }
  return {
    id: a.id,
    sym: a.currencyCode,
    loc: a.location ?? "",
    value,
    sub,
  };
}

// ─────────────────────────────────────────────
// ARCHIVED VIEW
// ─────────────────────────────────────────────

export type ArchivedView = {
  id: string;
  icon: string;
  iconKind: string;
  name: string;
  sub: string;
  ccy: string;
  value: string;
  updated: string;
};

function archivedAgo(archivedAt: Date | null, t: TFn, locale: Locale): string {
  if (!archivedAt) return t("wallet.archived.closed");
  const now = Date.now();
  const months = Math.floor(
    (now - archivedAt.getTime()) / (30 * 24 * 60 * 60 * 1000),
  );
  if (months < 1) return t("wallet.archived.recent");
  if (months < 12) return t("wallet.archived.months", { vars: { n: String(months) } });
  const years = Math.floor(months / 12);
  const word =
    locale === "ru"
      ? pluralRu(years, ["год", "года", "лет"])
      : pluralEn(years, "year", "years");
  return t("wallet.archived.years", { vars: { n: String(years), word } });
}

export function toArchivedView(
  a: AccountWithCurrency,
  t: TFn,
  locale: Locale = "ru",
): ArchivedView {
  return {
    id: a.id,
    icon: firstLetter(a.name),
    iconKind: a.kind.toLowerCase(),
    name: a.name,
    sub: a.sub ?? "",
    ccy: a.currencyCode,
    value: formatMoney(a.balance, a.currencyCode),
    updated: archivedAgo(a.archivedAt, t, locale),
  };
}

// ─────────────────────────────────────────────
// FX RATE VIEW
// ─────────────────────────────────────────────

export type FxRateView = {
  pair: [string, string];
  val: string;
  delta: string;
  deltaTone: "pos" | "neg" | "mut";
};

// FX table: rate increase = foreign currency gets more expensive = neg color.
export function toFxRateView(row: FxRateRow): FxRateView {
  const val = new Prisma.Decimal(row.rate).toFixed(2);
  if (row.delta24hPct === null) {
    return { pair: [row.fromCcy, row.toCcy], val, delta: "—", deltaTone: "mut" };
  }
  const pct = row.delta24hPct;
  if (pct.isZero()) {
    return { pair: [row.fromCcy, row.toCcy], val, delta: "0.0%", deltaTone: "mut" };
  }
  const up = pct.gt(0);
  return {
    pair: [row.fromCcy, row.toCcy],
    val,
    delta: `${up ? "▲" : "▼"} ${pct.abs().toFixed(1)}%`,
    deltaTone: up ? "neg" : "pos",
  };
}

// ─────────────────────────────────────────────
// WALLET TOTALS VIEW
// ─────────────────────────────────────────────

export type WalletTotalView = {
  k: string;
  value: number;
  tone: "acc" | "pos" | "info" | "warn";
  s: string;
};

export function toWalletTotalsView(totals: WalletTotals, t: TFn, locale: Locale = "ru"): WalletTotalView[] {
  const cashCount = totals.cash.accountsCount;
  const cashWord = locale === "ru"
    ? pluralRu(cashCount, ruPluralForms.locations)
    : pluralEn(cashCount, ...enPluralForms.locations);
  return [
    {
      k: t("wallet.totals.net_label"),
      value: Number(totals.net.valueBase.toFixed(0)),
      tone: "acc",
      s: t("wallet.totals.net_sub", { vars: { n: String(totals.net.accountsCount) } }),
    },
    {
      k: t("wallet.totals.banks_crypto_label"),
      value: Number(totals.liquid.valueBase.toFixed(0)),
      tone: "pos",
      s: t("wallet.totals.banks_crypto_sub"),
    },
    {
      k: t("wallet.totals.savings_label"),
      value: Number(totals.savings.valueBase.toFixed(0)),
      tone: "info",
      s: t("wallet.totals.savings_sub", { vars: { n: String(totals.savings.accountsCount) } }),
    },
    {
      k: t("wallet.totals.cash_label"),
      value: Number(totals.cash.valueBase.toFixed(0)),
      tone: "warn",
      s: t("wallet.totals.cash_sub", { vars: { n: String(cashCount), word: cashWord } }),
    },
  ];
}
