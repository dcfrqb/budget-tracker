import { Prisma } from "@prisma/client";
import type { AccountKind } from "@prisma/client";
import { formatAmount, formatRate, formatRubPrefix } from "@/lib/format/money";
import { formatRelative } from "@/lib/format/relative-time";
import type { Locale, TOptions } from "@/lib/i18n/types";
import type { TKey } from "@/lib/i18n/t";
import { convertToBase } from "@/lib/data/wallet";
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
  kind: string;            // lowercase для CSS ("card", "savings", …)
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

const KIND_LABEL: Record<AccountKind, string> = {
  CARD: "Дебет",
  CREDIT: "Кредит",
  SAVINGS: "Накоп.",
  CASH: "Наличные",
  CRYPTO: "Биржа",
  LOAN: "Автосписание",
};

const COL_PILL: Record<AccountKind, string> = {
  CARD: "Карта",
  CREDIT: "Кредитная",
  SAVINGS: "Накоп.",
  CASH: "Наличные",
  CRYPTO: "Крипто",
  LOAN: "Сервисн.",
};

function firstLetter(s: string): string {
  return s.trim().charAt(0).toUpperCase() || "?";
}

// Для крипты first-pill label из subtype (cold-wallet → Hardware, exchange/остальное → Биржа).
function cryptoKindLabelFromSubtype(subtype: string | null): string {
  return subtype === "cold-wallet" ? "Hardware" : "Биржа";
}

function approxRubString(
  amount: Prisma.Decimal | string | number,
  fromCcy: string,
  baseCcy: string,
  rates: Map<string, Prisma.Decimal>,
): string | null {
  const inBase = convertToBase(amount, fromCcy, baseCcy, rates);
  if (!inBase) return null;
  return `≈ ${formatRubPrefix(new Prisma.Decimal(inBase.toFixed(0))).replace("₽ ", "")} ₽`;
}

export function toAccountView(
  a: AccountWithCurrency,
  rates: Map<string, Prisma.Decimal>,
  baseCcy: string,
  locale: Locale = "ru",
): AccountView {
  const value = formatAmount(a.balance, a.currency);

  // Собираем updated из 2 частей: "≈ N ₽" (для инвалютных) + "обн N мин" (если трогали баланс).
  const parts: string[] = [];
  if (a.currencyCode !== baseCcy) {
    const approx = approxRubString(a.balance, a.currencyCode, baseCcy, rates);
    if (approx) parts.push(approx);
  }
  if (a.balanceUpdatedAt) {
    parts.push(`обн ${formatRelative(a.balanceUpdatedAt, locale)}`);
  }
  const updated = parts.length > 0 ? parts.join(" · ") : "обн";

  const kindLabel =
    a.kind === "CRYPTO"
      ? cryptoKindLabelFromSubtype(a.subtype)
      : KIND_LABEL[a.kind];

  const colPill = a.customPillLabel ?? COL_PILL[a.kind];

  // CREDIT-specific fields
  let creditDebt: string | undefined;
  let creditAvailable: string | undefined;
  let creditLimit: string | undefined;
  let creditNoLimit: boolean | undefined;

  if (a.kind === "CREDIT") {
    const bal = new Prisma.Decimal(a.balance);

    let debtAmt: Prisma.Decimal;
    if (a.debtBalance != null) {
      debtAmt = new Prisma.Decimal(a.debtBalance);
    } else {
      debtAmt = bal.lt(0) ? bal.abs() : new Prisma.Decimal(0);
    }
    creditDebt = formatAmount(debtAmt, a.currency);

    if (a.creditLimit != null) {
      const lim = new Prisma.Decimal(a.creditLimit);
      const available = lim.minus(debtAmt);
      const availableClamped = available.lt(0) ? new Prisma.Decimal(0) : available;
      creditAvailable = formatAmount(availableClamped, a.currency);
      creditLimit = formatAmount(lim, a.currency);
      creditNoLimit = false;
    } else {
      creditNoLimit = true;
    }
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
  total: string;
  share: string;
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
  grandTotalBase: Prisma.Decimal,
  locale: Locale = "ru",
): InstitutionView {
  const accounts = inst.accounts.map((a) => toAccountView(a, rates, baseCcy, locale));

  // Сумма этой институции в base.
  let instTotal = new Prisma.Decimal(0);
  for (const a of inst.accounts) {
    const v = convertToBase(a.balance, a.currencyCode, baseCcy, rates);
    if (v) instTotal = instTotal.plus(v);
  }

  const sharePct =
    grandTotalBase.isZero()
      ? ""
      : `${instTotal.div(grandTotalBase).times(100).toFixed(0)}% от итого`;

  const logo =
    inst.logo && KNOWN_LOGOS.has(inst.logo) ? inst.logo : "default";

  return {
    id: inst.id,
    logo,
    letter: firstLetter(inst.name),
    name: inst.name,
    sub: inst.sub ?? "",
    total: formatRubPrefix(new Prisma.Decimal(instTotal.toFixed(0))),
    share: sharePct,
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
  const value = formatAmount(a.balance, a.currency);
  let sub = a.sub ?? "";
  if (a.currencyCode !== baseCcy) {
    const inBase = convertToBase(a.balance, a.currencyCode, baseCcy, rates);
    if (inBase) {
      const rounded = new Prisma.Decimal(inBase.toFixed(0));
      sub = `≈ ${formatRubPrefix(rounded).replace("₽ ", "")} ₽${sub ? " · " + sub : ""}`;
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

function archivedAgo(archivedAt: Date | null): string {
  if (!archivedAt) return "закрыт";
  const now = Date.now();
  const months = Math.floor(
    (now - archivedAt.getTime()) / (30 * 24 * 60 * 60 * 1000),
  );
  if (months < 1) return "закрыт недавно";
  if (months < 12) return `закрыт ${months} мес назад`;
  const years = Math.floor(months / 12);
  return years === 1 ? "закрыт 1 год назад" : `закрыт ${years} года назад`;
}

export function toArchivedView(a: AccountWithCurrency): ArchivedView {
  return {
    id: a.id,
    icon: firstLetter(a.name),
    iconKind: a.kind.toLowerCase(),
    name: a.name,
    sub: a.sub ?? "",
    ccy: a.currencyCode,
    value: formatAmount(a.balance, a.currency),
    updated: archivedAgo(a.archivedAt),
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

// Для FX-таблицы: рост курса = валюта иностранная дорожает = цвет neg.
export function toFxRateView(row: FxRateRow): FxRateView {
  const val = formatRate(row.rate);
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

export function toWalletTotalsView(totals: WalletTotals, t: TFn): WalletTotalView[] {
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
      s: t("wallet.totals.cash_sub", { vars: { n: String(totals.cash.accountsCount) } }),
    },
  ];
}
