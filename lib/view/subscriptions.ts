// ─────────────────────────────────────────────────────────────
// Subscription view transformers — pure, no I/O
// t() is passed as argument so this module stays framework-agnostic.
// ─────────────────────────────────────────────────────────────

import { Prisma } from "@prisma/client";
import type { SharingType } from "@prisma/client";
import type { SubscriptionWithDetails, SubscriptionTotals } from "@/lib/data/subscriptions";
import { computeMyCost } from "@/lib/subscription-share";
import { formatAmount, formatRubPrefix } from "@/lib/format/money";
import { formatShortDate } from "@/lib/format/date";
import type { TKey } from "@/lib/i18n/t";
import type { Locale } from "@/lib/i18n/types";

type TFn = (key: TKey, options?: { vars?: Record<string, string | number> }) => string;

// ─── Card view ────────────────────────────────────────────

export type SubscriptionCardView = {
  id: string;
  name: string;
  icon: string | null;
  iconColor: string | null;
  iconBg: string | null;
  /** "личные" / "шеринг" / "за других" */
  badgeLabel: string;
  badgeClass: "personal" | "split" | "pays";
  /** Price string e.g. "900 ₽" */
  price: string;
  /** My share label if different from full price, e.g. "моя доля 450 ₽" */
  myShare: string | null;
  /** Interval label */
  interval: string;
  /** "след. 1 мая" */
  nextDate: string;
  nextToneOk: boolean;
  /** Number of people sharing with (for SPLIT / PAID_FOR_OTHERS) */
  sharesCount: number;
  sharingType: SharingType;
  /** Raw next payment date ISO string for pay dialog */
  nextPaymentDateIso: string;
  /** Billing interval months for optimistic shift */
  billingIntervalMonths: number;
};

function intervalLabel(months: number, t: TFn): string {
  if (months === 1) return t("expenses.subscriptions.card.intervalMonthly");
  if (months === 3) return t("expenses.subscriptions.card.intervalQuarterly");
  if (months === 12) return t("expenses.subscriptions.card.intervalYearly");
  return t("expenses.subscriptions.card.intervalCustom", { vars: { n: months } });
}

const BADGE_CLASS: Record<SharingType, "personal" | "split" | "pays"> = {
  PERSONAL: "personal",
  SPLIT: "split",
  PAID_FOR_OTHERS: "pays",
};

export function toSubscriptionCardView(
  sub: SubscriptionWithDetails,
  t: TFn,
  _rates: Map<string, Prisma.Decimal>,
  locale: Locale,
): SubscriptionCardView {
  const sharesInput = sub.shares.map((s) => ({
    amount: s.amount ? new Prisma.Decimal(s.amount) : null,
  }));

  const myCost = computeMyCost({
    price: new Prisma.Decimal(sub.price),
    shareMode: sub.sharingType,
    totalUsers: sub.totalUsers,
    shares: sharesInput,
  });

  const priceStr = formatAmount(sub.price, sub.currency);
  const myCostStr = formatAmount(myCost, sub.currency);

  const myShareStr =
    sub.sharingType !== "PERSONAL" && !myCost.equals(new Prisma.Decimal(sub.price))
      ? t("expenses.subscriptions.card.myShare", { vars: { amount: myCostStr } })
      : null;

  const now = new Date();
  const daysUntil = Math.ceil(
    (sub.nextPaymentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  const nextToneOk = daysUntil > 7;

  const badgeLabel =
    sub.sharingType === "PERSONAL"
      ? t("expenses.subscriptions.summary.personalLabel")
      : sub.sharingType === "SPLIT"
      ? t("expenses.subscriptions.summary.splitLabel")
      : t("expenses.subscriptions.summary.paidForOthersLabel");

  return {
    id: sub.id,
    name: sub.name,
    icon: sub.icon,
    iconColor: sub.iconColor,
    iconBg: sub.iconBg,
    badgeLabel,
    badgeClass: BADGE_CLASS[sub.sharingType],
    price: priceStr,
    myShare: myShareStr,
    interval: intervalLabel(sub.billingIntervalMonths, t),
    nextDate: t("expenses.subscriptions.card.nextPayment", {
      vars: { date: formatShortDate(sub.nextPaymentDate, locale) },
    }),
    nextToneOk,
    sharesCount: sub.shares.length,
    sharingType: sub.sharingType,
    nextPaymentDateIso: sub.nextPaymentDate.toISOString().slice(0, 10),
    billingIntervalMonths: sub.billingIntervalMonths,
  };
}

// ─── Group view ───────────────────────────────────────────

export type SubscriptionGroupKey = "personal" | "split" | "paidForOthers";

export type SubscriptionGroupView = {
  key: SubscriptionGroupKey;
  title: string;
  subtitle: string;
  empty: string;
  items: SubscriptionCardView[];
};

const GROUP_KEYS: Record<
  SubscriptionGroupKey,
  {
    title: TKey;
    subtitle: TKey;
    empty: TKey;
  }
> = {
  personal: {
    title: "expenses.subscriptions.group.personal.title",
    subtitle: "expenses.subscriptions.group.personal.subtitle",
    empty: "expenses.subscriptions.group.personal.empty",
  },
  split: {
    title: "expenses.subscriptions.group.split.title",
    subtitle: "expenses.subscriptions.group.split.subtitle",
    empty: "expenses.subscriptions.group.split.empty",
  },
  paidForOthers: {
    title: "expenses.subscriptions.group.paidForOthers.title",
    subtitle: "expenses.subscriptions.group.paidForOthers.subtitle",
    empty: "expenses.subscriptions.group.paidForOthers.empty",
  },
};

export function toSubscriptionGroupView(
  key: SubscriptionGroupKey,
  items: SubscriptionWithDetails[],
  t: TFn,
  rates: Map<string, Prisma.Decimal>,
  locale: Locale,
): SubscriptionGroupView {
  const cards = items.map((s) => toSubscriptionCardView(s, t, rates, locale));
  const keys = GROUP_KEYS[key];

  return {
    key,
    title: t(keys.title),
    subtitle: t(keys.subtitle, { vars: { count: items.length } }),
    empty: t(keys.empty),
    items: cards,
  };
}

// ─── Summary view ─────────────────────────────────────────

export type SubscriptionSummaryView = {
  activeCount: string;
  monthly: string;
  personalLabel: string;
  personalAmount: string;
  splitLabel: string;
  splitAmount: string;
  paidForOthersLabel: string;
  paidForOthersAmount: string;
};

export function toSubscriptionsSummaryView(
  totals: SubscriptionTotals,
  t: TFn,
): SubscriptionSummaryView {
  return {
    activeCount: t("expenses.subscriptions.summary.activeCount", {
      vars: { count: totals.activeCount },
    }),
    monthly: t("expenses.subscriptions.summary.monthly", {
      vars: { amount: formatRubPrefix(totals.monthlyBase).replace("₽ ", "") },
    }),
    personalLabel: t("expenses.subscriptions.summary.personalLabel"),
    personalAmount: formatRubPrefix(totals.personalBase),
    splitLabel: t("expenses.subscriptions.summary.splitLabel"),
    splitAmount: formatRubPrefix(totals.splitBase),
    paidForOthersLabel: t("expenses.subscriptions.summary.paidForOthersLabel"),
    paidForOthersAmount: formatRubPrefix(totals.paidForOthersBase),
  };
}
