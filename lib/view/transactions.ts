import { GroupKind, Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { formatMoney } from "@/lib/format/money";
import { convertToBase } from "@/lib/data/wallet";
import { DEFAULT_TZ } from "@/lib/constants";
import { weekdayIndexInTz, sameDayInTz } from "@/lib/format/date";
import type {
  PeriodSummary,
  TxnDayRaw,
  TxnWithJoins,
} from "@/lib/data/transactions";
import type { TKey } from "@/lib/i18n/t";
import type { CompensationProjection } from "@/lib/data/_shared/compensation-projection";

// ─────────────────────────────────────────────
// TYPES (compatible with mock-transactions)
// ─────────────────────────────────────────────

export type TxnKind = "inc" | "exp" | "xfr" | "loan";
export type TxnShortStatus = "planned" | "partial" | "done" | "missed" | "cancel";
export type Tone = "pos" | "neg" | "info" | "warn" | "dim";

export type TxnView = {
  id: string;
  kind: TxnKind;
  direction: "in" | "out" | "neutral";
  time: string;
  name: string;
  cat: string;
  note?: string;
  noteTone?: "acc" | "info" | "warn";
  account: string;
  accountId: string;
  transferId: string | null;
  compensationGroupId: string | null;
  compensationMainBadge: boolean;
  compensationMembersCount: number | null;
  mergeMainBadge: boolean;
  mergeMembersCount: number | null;
  subscriptionId: string | null;
  currencyCode: string;
  status: TxnShortStatus;
  statusLabel: string;
  amount: string;
  amountTone?: Tone;
  amountStrike?: boolean;
  fxEquiv?: string;
};

export type TxnDayTotal = {
  label: string;
  value: string;
  tone: "pos" | "neg" | "info" | "warn" | "mut";
};

export type TxnDayView = {
  date: string;       // "21.04"
  weekday: string;    // "Mon · today" | "Sun"
  totals: TxnDayTotal[];
  hasConvertedAmounts: boolean;   // true if the day had amounts converted from foreign ccy
  txns: TxnView[];
};

export type PeriodSummaryView = {
  inflow:    { value: number; count: number; avgAmount: string };
  outflow:   { value: number; count: number; avgAmount: string };
  transfers: { value: number; count: number };
  net:       { value: number; tone: "pos" | "neg" | "zero"; noteAmount: string };
  totalCount: number;
  plannedCount: number;
  partialCount: number;
};

// ─────────────────────────────────────────────
// t() helper type — passed as parameter
// ─────────────────────────────────────────────

type TFn = (key: TKey, options?: { vars?: Record<string, string | number> }) => string;

// ─────────────────────────────────────────────
// MAPS
// ─────────────────────────────────────────────

const STATUS_SHORT: Record<TransactionStatus, TxnShortStatus> = {
  PLANNED: "planned",
  PARTIAL: "partial",
  DONE: "done",
  MISSED: "missed",
  CANCELLED: "cancel",
};

const WEEKDAY_KEYS: Record<number, TKey> = {
  0: "transactions.weekday.sun",
  1: "transactions.weekday.mon",
  2: "transactions.weekday.tue",
  3: "transactions.weekday.wed",
  4: "transactions.weekday.thu",
  5: "transactions.weekday.fri",
  6: "transactions.weekday.sat",
};

function kindShort(k: TransactionKind): TxnKind {
  switch (k) {
    case "INCOME":
      return "inc";
    case "EXPENSE":
      return "exp";
    case "TRANSFER":
      return "xfr";
    case "LOAN_PAYMENT":
    case "DEBT_OUT":
    case "DEBT_IN":
      return "loan";
  }
}

function kindDirection(k: TransactionKind): "in" | "out" | "neutral" {
  switch (k) {
    case "INCOME":
    case "DEBT_IN":
      return "in";
    case "EXPENSE":
    case "LOAN_PAYMENT":
    case "DEBT_OUT":
      return "out";
    case "TRANSFER":
      return "neutral";
  }
}

// ─────────────────────────────────────────────
// FORMAT HELPERS
// ─────────────────────────────────────────────

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

// "21.04" — day label in user's timezone.
// en-CA gives YYYY-MM-DD; we extract DD and MM for the "DD.MM" format.
export function formatDateRu(d: Date, tz: string = DEFAULT_TZ): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const day = parts.find((p) => p.type === "day")?.value ?? "??";
  const month = parts.find((p) => p.type === "month")?.value ?? "??";
  return `${day}.${month}`;
}

// "Mon · today" / "Sun" / "Tue" — locale-aware via t().
export function formatWeekdayRu(d: Date, today: Date, t: TFn, tz: string = DEFAULT_TZ): string {
  const weekdayKey = WEEKDAY_KEYS[weekdayIndexInTz(d, tz)];
  const weekday = t(weekdayKey);
  return sameDayInTz(d, today, tz) ? `${weekday} ${t("transactions.day.today")}` : weekday;
}

export function formatTime(d: Date): string {
  // Use local time so displayed HH:MM matches what the user sees in their bank app.
  // Requires TZ env var to be set correctly on the server (e.g. TZ=Europe/Moscow).
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// "+1 599 ₽" / "−1 860 ₽" / "1 599 ₽" (transfer) / "+$ 45.00".
// sign="-" yields Unicode minus (U+2212), not ASCII hyphen, for consistency.
function signedAmount(
  amount: Prisma.Decimal | string,
  currency: { code: string; symbol: string; decimals: number },
  sign: "+" | "-" | "",
): string {
  const body = formatMoney(amount, currency.code);
  if (sign === "") return body;
  const visibleSign = sign === "-" ? "−" : "+";
  return `${visibleSign}${body}`;
}

// ─────────────────────────────────────────────
// SINGLE TRANSACTION → TxnView
// ─────────────────────────────────────────────

function amountToneAndPrefix(
  t: TxnWithJoins,
): { tone: Tone; sign: "+" | "-" | ""; strike: boolean } {
  if (t.status === TransactionStatus.CANCELLED) {
    return {
      tone: "dim",
      sign: t.kind === TransactionKind.EXPENSE ? "-" : "+",
      strike: true,
    };
  }
  if (t.status === TransactionStatus.PLANNED) {
    if (t.kind === TransactionKind.EXPENSE) return { tone: "dim", sign: "-", strike: false };
    if (t.kind === TransactionKind.INCOME) return { tone: "dim", sign: "+", strike: false };
  }
  switch (t.kind) {
    case "INCOME":
    case "DEBT_IN":
      return { tone: "pos", sign: "+", strike: false };
    case "EXPENSE":
      return { tone: "info", sign: "-", strike: false };
    case "TRANSFER":
      return { tone: "warn", sign: "", strike: false };
    case "LOAN_PAYMENT":
    case "DEBT_OUT":
      return { tone: "neg", sign: "-", strike: false };
  }
}

function resolveAccountLabel(t: TxnWithJoins): string {
  const baseName = t.account.institution?.name ?? t.account.name;
  if (t.kind === TransactionKind.TRANSFER && t.transfer) {
    if (t.accountId === t.transfer.fromAccountId) {
      const toName = t.transfer.toAccount.institution?.name ?? t.transfer.toAccount.name;
      return `${baseName} → ${toName}`;
    }
    if (t.accountId === t.transfer.toAccountId) {
      return `→ ${baseName}`;
    }
  }
  return baseName;
}

function resolveNote(
  txn: TxnWithJoins,
): { note?: string; noteTone?: "acc" | "info" | "warn" } {
  if (txn.note) {
    if (txn.note.startsWith("import:")) return {};
    return { note: txn.note };
  }
  return {};
}


export function toTxnView(
  txn: TxnWithJoins,
  t: TFn,
  rates?: Map<string, Prisma.Decimal>,
  baseCcy?: string,
  proj?: CompensationProjection,
): TxnView {
  const { tone, sign, strike } = amountToneAndPrefix(txn);
  const { note, noteTone } = resolveNote(txn);

  // Compensation/Merge projection: check if this txn is a group main
  const groupInfo = proj?.groupByMainTxnId.get(txn.id) ?? null;
  const isGroupMain = groupInfo !== null;
  const isCompensationMain = isGroupMain && groupInfo?.kind === GroupKind.COMPENSATION;
  const isMergeMain = isGroupMain && groupInfo?.kind === GroupKind.MERGE;

  let displayAmount = txn.amount;
  let displaySign = sign;
  let fxEquiv: string | undefined;

  if (isCompensationMain && groupInfo && rates && baseCcy) {
    // For COMPENSATION mains: rewrite amount to netto in native ccy
    const { netBase, sign: netSign } = { netBase: groupInfo.nettoBase, sign: groupInfo.nettoSign };
    if (txn.currencyCode === baseCcy) {
      displayAmount = netBase;
    } else {
      const rateToBase = rates.get(`${txn.currencyCode}-${baseCcy}`);
      if (rateToBase) {
        displayAmount = netBase.div(rateToBase);
      } else {
        const inverseRate = rates.get(`${baseCcy}-${txn.currencyCode}`);
        if (inverseRate) {
          displayAmount = netBase.mul(inverseRate);
        }
      }
      fxEquiv = formatMoney(new Prisma.Decimal(netBase.toFixed(0)), baseCcy, { approx: true });
    }
    displaySign = netSign === 1 ? "+" : "-";
  } else if (isMergeMain && groupInfo && rates && baseCcy) {
    // For MERGE mains: display the cached representative sum (Σ members) in native ccy
    const netBase = groupInfo.nettoBase;
    const netSign = groupInfo.nettoSign;
    if (txn.currencyCode === baseCcy) {
      displayAmount = netBase;
    } else {
      const rateToBase = rates.get(`${txn.currencyCode}-${baseCcy}`);
      if (rateToBase) {
        displayAmount = netBase.div(rateToBase);
      } else {
        const inverseRate = rates.get(`${baseCcy}-${txn.currencyCode}`);
        if (inverseRate) {
          displayAmount = netBase.mul(inverseRate);
        }
      }
      fxEquiv = formatMoney(new Prisma.Decimal(netBase.toFixed(0)), baseCcy, { approx: true });
    }
    displaySign = netSign === 1 ? "+" : "-";
  } else if (rates && baseCcy && txn.currencyCode !== baseCcy) {
    const inBase = convertToBase(txn.amount, txn.currencyCode, baseCcy, rates);
    if (inBase) {
      fxEquiv = formatMoney(new Prisma.Decimal(inBase.toFixed(0)), baseCcy, { approx: true });
    }
  }

  return {
    id: txn.id,
    kind: kindShort(txn.kind),
    direction: kindDirection(txn.kind),
    time: formatTime(txn.occurredAt),
    name: txn.name,
    cat: txn.category?.name ?? "—",
    ...(note ? { note } : {}),
    ...(noteTone ? { noteTone } : {}),
    account: resolveAccountLabel(txn),
    accountId: txn.accountId,
    transferId: txn.transferId ?? null,
    compensationGroupId: txn.compensationGroupId ?? null,
    compensationMainBadge: isCompensationMain,
    compensationMembersCount: isCompensationMain && groupInfo ? groupInfo.memberCount : null,
    mergeMainBadge: isMergeMain,
    mergeMembersCount: isMergeMain && groupInfo ? groupInfo.memberCount : null,
    subscriptionId: txn.subscriptionId ?? null,
    currencyCode: txn.currencyCode,
    status: STATUS_SHORT[txn.status],
    statusLabel: t(`transactions.status.${STATUS_SHORT[txn.status]}` as TKey),
    amount: signedAmount(displayAmount, txn.currency, displaySign),
    amountTone: tone,
    ...(strike ? { amountStrike: true } : {}),
    ...(fxEquiv ? { fxEquiv } : {}),
  };
}

// ─────────────────────────────────────────────
// DAY GROUP → TxnDayView
// ─────────────────────────────────────────────


function dayTotalsFromTxns(
  txns: TxnWithJoins[],
  rates: Map<string, Prisma.Decimal>,
  baseCcy: string,
  t: TFn,
  proj?: CompensationProjection,
): { totals: TxnDayTotal[]; hasConvertedAmounts: boolean } {
  let inflowTotal = new Prisma.Decimal(0);
  let outflowTotal = new Prisma.Decimal(0);
  let plannedCount = 0;
  let cancelledCount = 0;
  let hasConverted = false;

  for (const txn of txns) {
    if (txn.status === TransactionStatus.PLANNED) plannedCount += 1;
    if (txn.status === TransactionStatus.CANCELLED) {
      cancelledCount += 1;
      continue;
    }
    if (txn.status !== TransactionStatus.DONE && txn.status !== TransactionStatus.PARTIAL) {
      continue;
    }

    // For compensation mains: use nettoBase directly (already in baseCcy)
    const override = proj?.rewriteAmount(txn.id);
    if (override) {
      if (override.sign === 1) inflowTotal = inflowTotal.plus(override.netBase);
      else outflowTotal = outflowTotal.plus(override.netBase);
      continue;
    }

    // For MERGE mains: nettoBase is the cached Σ of all members (already in baseCcy).
    // Non-main members were folded out of the feed, so we must use the group sum here.
    const mergeGroupInfo = proj?.groupByMainTxnId.get(txn.id);
    if (mergeGroupInfo?.kind === GroupKind.MERGE) {
      if (mergeGroupInfo.nettoSign === 1) inflowTotal = inflowTotal.plus(mergeGroupInfo.nettoBase);
      else outflowTotal = outflowTotal.plus(mergeGroupInfo.nettoBase);
      continue;
    }

    const amt = new Prisma.Decimal(txn.amount);
    const isInflow =
      txn.kind === TransactionKind.INCOME ||
      txn.kind === TransactionKind.DEBT_IN;
    const isOutflow =
      txn.kind === TransactionKind.EXPENSE ||
      txn.kind === TransactionKind.LOAN_PAYMENT ||
      txn.kind === TransactionKind.DEBT_OUT;
    if (!isInflow && !isOutflow) continue;
    const actual =
      txn.status === TransactionStatus.PARTIAL
        ? txn.facts.reduce((a, f) => a.plus(f.amount), new Prisma.Decimal(0))
        : amt;
    const inBase = convertToBase(actual, txn.currencyCode, baseCcy, rates);
    if (!inBase) {
      console.warn(`[day-totals] skip tx ${txn.id}: no rate ${txn.currencyCode}→${baseCcy}`);
      continue;
    }
    if (txn.currencyCode !== baseCcy) hasConverted = true;
    if (isInflow) inflowTotal = inflowTotal.plus(inBase);
    else outflowTotal = outflowTotal.plus(inBase);
  }

  const totals: TxnDayTotal[] = [];
  const hasSettled = txns.some((txn) => {
    if (
      txn.status !== TransactionStatus.DONE &&
      txn.status !== TransactionStatus.PARTIAL
    )
      return false;
    const kindIsInflow =
      txn.kind === TransactionKind.INCOME ||
      txn.kind === TransactionKind.DEBT_IN;
    const kindIsOutflow =
      txn.kind === TransactionKind.EXPENSE ||
      txn.kind === TransactionKind.LOAN_PAYMENT ||
      txn.kind === TransactionKind.DEBT_OUT;
    return kindIsInflow || kindIsOutflow;
  });
  if (!inflowTotal.isZero() || !outflowTotal.isZero() || hasSettled) {
    const net = inflowTotal.minus(outflowTotal);
    const netTone: TxnDayTotal["tone"] = net.isZero()
      ? "mut"
      : net.greaterThan(0)
      ? "pos"
      : "neg";
    totals.push({
      label: t("transactions.feed.daily_net"),
      value: formatMoney(net, "RUB", { signDisplay: "always", approx: hasConverted }),
      tone: netTone,
    });
  }
  if (plannedCount > 0) {
    totals.push({
      label: t("transactions.day.planned"),
      value: t("transactions.day.expected", { vars: { n: String(plannedCount) } }),
      tone: "mut",
    });
  }
  if (cancelledCount > 0) {
    totals.push({
      label: "",
      value: t("transactions.day.cancelled", { vars: { n: String(cancelledCount) } }),
      tone: "mut",
    });
  }
  return { totals, hasConvertedAmounts: hasConverted };
}

function formatRub(amount: Prisma.Decimal): string {
  return formatMoney(amount, "RUB");
}

export function toTxnDayView(
  raw: TxnDayRaw,
  today: Date,
  rates: Map<string, Prisma.Decimal>,
  baseCcy: string,
  t: TFn,
  tz: string = DEFAULT_TZ,
  proj?: CompensationProjection,
): TxnDayView {
  const d = new Date(raw.date + "T00:00:00Z");
  const { totals, hasConvertedAmounts } = dayTotalsFromTxns(raw.txns, rates, baseCcy, t, proj);
  return {
    date: formatDateRu(d, tz),
    weekday: formatWeekdayRu(d, today, t, tz),
    totals,
    hasConvertedAmounts,
    txns: raw.txns.map((txn) => toTxnView(txn, t, rates, baseCcy, proj)),
  };
}

// ─────────────────────────────────────────────
// PERIOD SUMMARY
// ─────────────────────────────────────────────

export function toPeriodSummaryView(s: PeriodSummary): PeriodSummaryView {
  const avgAmount = (total: Prisma.Decimal, count: number) =>
    count > 0
      ? formatRub(total.div(count).toDecimalPlaces(0))
      : formatRub(new Prisma.Decimal(0));

  const netValue = Number(s.net.toFixed(0));
  const netTone: "pos" | "neg" | "zero" = s.net.gt(0) ? "pos" : s.net.lt(0) ? "neg" : "zero";

  return {
    inflow: {
      value: Number(s.inflow.value.toFixed(0)),
      count: s.inflow.count,
      avgAmount: avgAmount(s.inflow.value, s.inflow.count),
    },
    outflow: {
      value: Number(s.outflow.value.toFixed(0)),
      count: s.outflow.count,
      avgAmount: avgAmount(s.outflow.value, s.outflow.count),
    },
    transfers: {
      value: Number(s.transfers.value.toFixed(0)),
      count: s.transfers.count,
    },
    net: {
      value: netValue,
      tone: netTone,
      noteAmount: formatRub(s.net.abs()),
    },
    totalCount: s.totalCount,
    plannedCount: s.planned.count,
    partialCount: s.partial.count,
  };
}
