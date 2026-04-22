import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { formatAmount } from "@/lib/format/money";
import { convertToBase } from "@/lib/data/wallet";
import type {
  PeriodSummary,
  TxnDayRaw,
  TxnWithJoins,
} from "@/lib/data/transactions";

// ─────────────────────────────────────────────
// TYPES (совместимы с mock-transactions)
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
  weekday: string;    // "пн · сегодня" | "вс"
  totals: TxnDayTotal[];
  hasConvertedAmounts: boolean;   // true если в дне была конверсия из foreign ccy
  txns: TxnView[];
};

export type PeriodSummaryView = {
  inflow:    { value: number; count: number; avg: string };
  outflow:   { value: number; count: number; avg: string };
  transfers: { value: number; count: number; avg: string };
  net:       { value: number; note: string };
  metaLine:  string;
};

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

const STATUS_LABEL: Record<TransactionStatus, string> = {
  PLANNED: "Запланир.",
  PARTIAL: "Частично",
  DONE: "Выполнено",
  MISSED: "Пропущ.",
  CANCELLED: "Отменено",
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

const WEEKDAYS_RU = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

// "21.04" из UTC компонент даты — мы всё храним в UTC, избегаем local-TZ дрейфа.
export function formatDateRu(d: Date): string {
  return `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}`;
}

// "пн · сегодня" / "вс" / "вт".
export function formatWeekdayRu(d: Date, today: Date): string {
  const weekday = WEEKDAYS_RU[d.getUTCDay()];
  const sameDay =
    d.getUTCFullYear() === today.getUTCFullYear() &&
    d.getUTCMonth() === today.getUTCMonth() &&
    d.getUTCDate() === today.getUTCDate();
  return sameDay ? `${weekday} · сегодня` : weekday;
}

export function formatTime(d: Date): string {
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

// "+₽ 120 000" / "−₽ 1 860" / "₽ 20 000" (transfer) / "+$ 45 000".
// sign="-" даёт Unicode minus (U+2212), не ASCII hyphen, для консистентности
// с day-totals и моком.
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
  t: TxnWithJoins,
): { note?: string; noteTone?: "acc" | "info" | "warn" } {
  if (t.isReimbursable && t.reimbursementFromName) {
    const received = t.reimbursements.reduce(
      (acc, r) => acc.plus(r.amount),
      new Prisma.Decimal(0),
    );
    const expected = t.expectedReimbursement
      ? new Prisma.Decimal(t.expectedReimbursement)
      : null;

    // Полностью компенсировано → "pos" tone, "получ." без "из".
    if (expected && !received.isZero() && received.gte(expected)) {
      return {
        note: `компенс. · ${t.reimbursementFromName} · получ. ${reverseSymbol(formatAmount(received, t.currency))}`,
        noteTone: "acc",
      };
    }
    // Частично компенсировано → "warn" tone, "получ. X из Y".
    if (!received.isZero()) {
      const recStr = reverseSymbol(formatAmount(received, t.currency));
      if (expected) {
        const expStr = reverseSymbol(formatAmount(expected, t.currency));
        return {
          note: `компенс. · ${t.reimbursementFromName} · получ. ${recStr} из ${expStr}`,
          noteTone: "warn",
        };
      }
      return {
        note: `компенс. · ${t.reimbursementFromName} · получ. ${recStr}`,
        noteTone: "warn",
      };
    }
    // Ничего не получено — ожидаемая сумма.
    const expectedSuffix = expected
      ? ` · ожид. ${reverseSymbol(formatAmount(expected, t.currency))}`
      : "";
    return {
      note: `компенс. · ${t.reimbursementFromName}${expectedSuffix}`,
      noteTone: "warn",
    };
  }
  if (t.note) {
    return { note: t.note };
  }
  return {};
}

// "3 000 ₽" → "₽ 3 000" (для встраивания после "ожид. ").
function reverseSymbol(formatted: string): string {
  const [num, sym] = splitTail(formatted);
  return `${sym} ${num}`;
}

export function toTxnView(t: TxnWithJoins): TxnView {
  const { tone, sign, strike } = amountToneAndPrefix(t);
  const { note, noteTone } = resolveNote(t);

  return {
    id: t.id,
    kind: kindShort(t.kind),
    time: formatTime(t.occurredAt),
    name: t.name,
    cat: t.category?.name ?? "—",
    ...(note ? { note } : {}),
    ...(noteTone ? { noteTone } : {}),
    account: resolveAccountLabel(t),
    status: STATUS_SHORT[t.status],
    statusLabel: STATUS_LABEL[t.status],
    amount: signedAmount(t.amount, t.currency, sign),
    amountTone: tone,
    ...(strike ? { amountStrike: true } : {}),
    ...(t.isReimbursable ? { reimbursable: true } : {}),
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
): { totals: TxnDayTotal[]; hasConvertedAmounts: boolean } {
  let inflowTotal = new Prisma.Decimal(0);
  let outflowTotal = new Prisma.Decimal(0);
  let plannedCount = 0;
  let cancelledCount = 0;
  let hasConverted = false;

  for (const t of txns) {
    if (t.status === TransactionStatus.PLANNED) plannedCount += 1;
    if (t.status === TransactionStatus.CANCELLED) {
      cancelledCount += 1;
      continue;
    }
    const amt = new Prisma.Decimal(t.amount);
    const isInflow =
      t.kind === TransactionKind.INCOME ||
      t.kind === TransactionKind.REIMBURSEMENT ||
      t.kind === TransactionKind.DEBT_IN;
    const isOutflow =
      t.kind === TransactionKind.EXPENSE ||
      t.kind === TransactionKind.LOAN_PAYMENT ||
      t.kind === TransactionKind.DEBT_OUT;
    if (!isInflow && !isOutflow) continue;
    if (t.status !== TransactionStatus.DONE && t.status !== TransactionStatus.PARTIAL) {
      continue;
    }
    const actual =
      t.status === TransactionStatus.PARTIAL
        ? t.facts.reduce((a, f) => a.plus(f.amount), new Prisma.Decimal(0))
        : amt;
    const inBase = convertToBase(actual, t.currencyCode, baseCcy, rates);
    if (!inBase) {
      console.warn(`[day-totals] skip tx ${t.id}: no rate ${t.currencyCode}→${baseCcy}`);
      continue;
    }
    if (t.currencyCode !== baseCcy) hasConverted = true;
    if (isInflow) inflowTotal = inflowTotal.plus(inBase);
    else outflowTotal = outflowTotal.plus(inBase);
  }

  const totals: TxnDayTotal[] = [];
  const hasInflowKind = txns.some(
    (t) =>
      t.kind === TransactionKind.INCOME ||
      t.kind === TransactionKind.REIMBURSEMENT ||
      t.kind === TransactionKind.DEBT_IN,
  );
  const prefix = hasConverted ? "≈ " : "";
  if (!inflowTotal.isZero() || plannedCount > 0 || hasInflowKind) {
    totals.push({
      label: "приток",
      value: `${prefix}+${formatRub(inflowTotal)}`,
      tone: "pos",
    });
  }
  if (!outflowTotal.isZero()) {
    totals.push({
      label: "отток",
      value: `${prefix}−${formatRub(outflowTotal)}`,
      tone: "info",
    });
  }
  if (plannedCount > 0) {
    totals.push({
      label: "план",
      value: `${plannedCount} ожидается`,
      tone: "mut",
    });
  }
  if (cancelledCount > 0) {
    totals.push({
      label: "",
      value: `${cancelledCount} отменено`,
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
): TxnDayView {
  const d = new Date(raw.date + "T00:00:00Z");
  const { totals, hasConvertedAmounts } = dayTotalsFromTxns(raw.txns, rates, baseCcy);
  return {
    date: formatDateRu(d),
    weekday: formatWeekdayRu(d, today),
    totals,
    hasConvertedAmounts,
    txns: raw.txns.map(toTxnView),
  };
}

// ─────────────────────────────────────────────
// PERIOD SUMMARY
// ─────────────────────────────────────────────

export function toPeriodSummaryView(s: PeriodSummary): PeriodSummaryView {
  const avg = (total: Prisma.Decimal, count: number) =>
    count > 0
      ? formatRub(total.div(count).toDecimalPlaces(0))
      : formatRub(new Prisma.Decimal(0));

  return {
    inflow: {
      value: Number(s.inflow.value.toFixed(0)),
      count: s.inflow.count,
      avg: `ср ${avg(s.inflow.value, s.inflow.count)}`,
    },
    outflow: {
      value: Number(s.outflow.value.toFixed(0)),
      count: s.outflow.count,
      avg: `ср ${avg(s.outflow.value, s.outflow.count)}`,
    },
    transfers: {
      value: Number(s.transfers.value.toFixed(0)),
      count: s.transfers.count,
      avg: `${s.transfers.count} операций`,
    },
    net: {
      value: Number(s.net.toFixed(0)),
      note: s.net.isPositive()
        ? `прогноз месяца +${formatRub(s.net)}`
        : `дефицит ${formatRub(s.net.abs())}`,
    },
    metaLine: [
      `${s.totalCount} транз.`,
      s.planned.count > 0 ? `${s.planned.count} план` : null,
      s.partial.count > 0 ? `${s.partial.count} частично` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}
