import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { formatAmount } from "@/lib/format/money";
import { convertToBase } from "@/lib/data/wallet";
import { DEFAULT_TZ } from "@/lib/constants";
import type {
  PeriodSummary,
  TxnDayRaw,
  TxnWithJoins,
} from "@/lib/data/transactions";
import type { TKey } from "@/lib/i18n/t";

// ─────────────────────────────────────────────
// TYPES (compatible with mock-transactions)
// ─────────────────────────────────────────────

export type TxnKind = "inc" | "exp" | "xfr" | "loan";
export type TxnShortStatus = "planned" | "partial" | "done" | "missed" | "cancel";
export type Tone = "pos" | "neg" | "info" | "warn" | "dim";

export type TxnView = {
  id: string;
  kind: TxnKind;
  time: string;
  name: string;
  cat: string;
  note?: string;
  noteTone?: "acc" | "info" | "warn";
  account: string;
  status: TxnShortStatus;
  statusLabel: string;
  amount: string;
  amountTone?: Tone;
  amountStrike?: boolean;
  reimbursable?: boolean;
};

export type TxnDayTotal = {
  label: string;
  value: string;
  tone: "pos" | "info" | "warn" | "mut";
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
    case "REIMBURSEMENT":
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

// ─────────────────────────────────────────────
// FORMAT HELPERS
// ─────────────────────────────────────────────

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

// "21.04" — day label in user's timezone (DEFAULT_TZ).
// en-CA gives YYYY-MM-DD; we extract DD and MM for the "DD.MM" format.
// TODO: replace DEFAULT_TZ with User.timezone when user-level timezone is added.
export function formatDateRu(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const day = parts.find((p) => p.type === "day")?.value ?? "??";
  const month = parts.find((p) => p.type === "month")?.value ?? "??";
  return `${day}.${month}`;
}

// Weekday key resolved in user's timezone (DEFAULT_TZ).
// TODO: replace DEFAULT_TZ with User.timezone when user-level timezone is added.
function getWeekdayInTz(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DEFAULT_TZ,
    weekday: "short",
  }).formatToParts(d);
  const short = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[short] ?? 0;
}

// Day-equality check in user's timezone (DEFAULT_TZ).
function sameDayInTz(a: Date, b: Date): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(a) === fmt.format(b);
}

// "Mon · today" / "Sun" / "Tue" — locale-aware via t().
export function formatWeekdayRu(d: Date, today: Date, t: TFn): string {
  const weekdayKey = WEEKDAY_KEYS[getWeekdayInTz(d)];
  const weekday = t(weekdayKey);
  return sameDayInTz(d, today) ? `${weekday} ${t("transactions.day.today")}` : weekday;
}

export function formatTime(d: Date): string {
  // Use local time so displayed HH:MM matches what the user sees in their bank app.
  // Requires TZ env var to be set correctly on the server (e.g. TZ=Europe/Moscow).
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// "+₽ 120 000" / "−₽ 1 860" / "₽ 20 000" (transfer) / "+$ 45 000".
// sign="-" yields Unicode minus (U+2212), not ASCII hyphen, for consistency
// with day-totals and mock data.
function signedAmount(
  amount: Prisma.Decimal | string,
  currency: { code: string; symbol: string; decimals: number },
  sign: "+" | "-" | "",
): string {
  const base = formatAmount(amount, currency);
  const [num, sym] = splitTail(base);
  if (sign === "") return `${sym} ${num}`;
  const visibleSign = sign === "-" ? "−" : "+";
  return `${visibleSign}${sym} ${num}`;
}

function splitTail(s: string): [string, string] {
  const idx = s.lastIndexOf(" ");
  return [s.slice(0, idx), s.slice(idx + 1)];
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
    case "REIMBURSEMENT":
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
    if (t.accountId === t.transfer.toAccountId) {
      return `→ ${baseName}`;
    }
  }
  return baseName;
}

function resolveNote(
  txn: TxnWithJoins,
  t: TFn,
): { note?: string; noteTone?: "acc" | "info" | "warn" } {
  if (txn.isReimbursable && txn.reimbursementFromName) {
    const received = txn.reimbursements.reduce(
      (acc, r) => acc.plus(r.amount),
      new Prisma.Decimal(0),
    );
    const expected = txn.expectedReimbursement
      ? new Prisma.Decimal(txn.expectedReimbursement)
      : null;

    const prefix = t("transactions.reimbursement.prefix");

    // Fully reimbursed → "acc" tone, "received" without "of".
    if (expected && !received.isZero() && received.gte(expected)) {
      const recStr = reverseSymbol(formatAmount(received, txn.currency));
      return {
        note: `${prefix} · ${txn.reimbursementFromName} · ${t("transactions.reimbursement.received")} ${recStr}`,
        noteTone: "acc",
      };
    }
    // Partially reimbursed → "warn" tone, "received X of Y".
    if (!received.isZero()) {
      const recStr = reverseSymbol(formatAmount(received, txn.currency));
      if (expected) {
        const expStr = reverseSymbol(formatAmount(expected, txn.currency));
        return {
          note: `${prefix} · ${txn.reimbursementFromName} · ${t("transactions.reimbursement.received_partial", { vars: { rec: recStr, exp: expStr } })}`,
          noteTone: "warn",
        };
      }
      return {
        note: `${prefix} · ${txn.reimbursementFromName} · ${t("transactions.reimbursement.received_no_exp", { vars: { rec: recStr } })}`,
        noteTone: "warn",
      };
    }
    // Nothing received yet — show expected amount.
    const expectedSuffix = expected
      ? ` · ${t("transactions.reimbursement.expected", { vars: { amount: reverseSymbol(formatAmount(expected, txn.currency)) } })}`
      : "";
    return {
      note: `${prefix} · ${txn.reimbursementFromName}${expectedSuffix}`,
      noteTone: "warn",
    };
  }
  if (txn.note) {
    if (txn.note.startsWith("import:")) return {};
    return { note: txn.note };
  }
  return {};
}

// "3 000 ₽" → "₽ 3 000" (for embedding after "expected").
function reverseSymbol(formatted: string): string {
  const [num, sym] = splitTail(formatted);
  return `${sym} ${num}`;
}

export function toTxnView(txn: TxnWithJoins, t: TFn): TxnView {
  const { tone, sign, strike } = amountToneAndPrefix(txn);
  const { note, noteTone } = resolveNote(txn, t);

  return {
    id: txn.id,
    kind: kindShort(txn.kind),
    time: formatTime(txn.occurredAt),
    name: txn.name,
    cat: txn.category?.name ?? "—",
    ...(note ? { note } : {}),
    ...(noteTone ? { noteTone } : {}),
    account: resolveAccountLabel(txn),
    status: STATUS_SHORT[txn.status],
    statusLabel: t(`transactions.status.${STATUS_SHORT[txn.status]}` as TKey),
    amount: signedAmount(txn.amount, txn.currency, sign),
    amountTone: tone,
    ...(strike ? { amountStrike: true } : {}),
    ...(txn.isReimbursable ? { reimbursable: true } : {}),
  };
}

// ─────────────────────────────────────────────
// DAY GROUP → TxnDayView
// ─────────────────────────────────────────────

const RUB_SHAPE = { code: "RUB", symbol: "₽", decimals: 2 };

function dayTotalsFromTxns(
  txns: TxnWithJoins[],
  rates: Map<string, Prisma.Decimal>,
  baseCcy: string,
  t: TFn,
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
    const amt = new Prisma.Decimal(txn.amount);
    const isInflow =
      txn.kind === TransactionKind.INCOME ||
      txn.kind === TransactionKind.REIMBURSEMENT ||
      txn.kind === TransactionKind.DEBT_IN;
    const isOutflow =
      txn.kind === TransactionKind.EXPENSE ||
      txn.kind === TransactionKind.LOAN_PAYMENT ||
      txn.kind === TransactionKind.DEBT_OUT;
    if (!isInflow && !isOutflow) continue;
    if (txn.status !== TransactionStatus.DONE && txn.status !== TransactionStatus.PARTIAL) {
      continue;
    }
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
  const prefix = hasConverted ? "≈ " : "";
  const hasSettled = txns.some((txn) => {
    if (
      txn.status !== TransactionStatus.DONE &&
      txn.status !== TransactionStatus.PARTIAL
    )
      return false;
    const kindIsInflow =
      txn.kind === TransactionKind.INCOME ||
      txn.kind === TransactionKind.REIMBURSEMENT ||
      txn.kind === TransactionKind.DEBT_IN;
    const kindIsOutflow =
      txn.kind === TransactionKind.EXPENSE ||
      txn.kind === TransactionKind.LOAN_PAYMENT ||
      txn.kind === TransactionKind.DEBT_OUT;
    return kindIsInflow || kindIsOutflow;
  });
  if (!inflowTotal.isZero() || !outflowTotal.isZero() || hasSettled) {
    const net = inflowTotal.minus(outflowTotal);
    const absNet = net.abs();
    const sign = net.greaterThanOrEqualTo(0) ? "+" : "−";
    const tone: TxnDayTotal["tone"] = net.greaterThan(0)
      ? "pos"
      : net.lessThan(0)
        ? "info"
        : "mut";
    totals.push({
      label: "",
      value: `${prefix}${sign}${formatRub(absNet)}`,
      tone,
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
  const base = formatAmount(amount, RUB_SHAPE);
  const [num, sym] = splitTail(base);
  return `${sym} ${num}`;
}

export function toTxnDayView(
  raw: TxnDayRaw,
  today: Date,
  rates: Map<string, Prisma.Decimal>,
  baseCcy: string,
  t: TFn,
): TxnDayView {
  const d = new Date(raw.date + "T00:00:00Z");
  const { totals, hasConvertedAmounts } = dayTotalsFromTxns(raw.txns, rates, baseCcy, t);
  return {
    date: formatDateRu(d),
    weekday: formatWeekdayRu(d, today, t),
    totals,
    hasConvertedAmounts,
    txns: raw.txns.map((txn) => toTxnView(txn, t)),
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
