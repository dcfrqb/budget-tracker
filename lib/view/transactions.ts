import { Prisma, TransactionKind, TransactionStatus } from "@prisma/client";
import { formatAmount } from "@/lib/format/money";
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
    const expected = t.expectedReimbursement
      ? formatAmount(t.expectedReimbursement, t.currency)
      : null;
    const expectedSuffix = expected ? ` · ожид. ${reverseSymbol(expected)}` : "";
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

function dayTotalsFromTxns(txns: TxnWithJoins[]): TxnDayTotal[] {
  const inflow = new Prisma.Decimal(0);
  const outflow = new Prisma.Decimal(0);
  let plannedCount = 0;
  let cancelledCount = 0;

  let inflowTotal = inflow;
  let outflowTotal = outflow;

  for (const t of txns) {
    if (t.status === TransactionStatus.PLANNED) plannedCount += 1;
    if (t.status === TransactionStatus.CANCELLED) {
      cancelledCount += 1;
      continue;
    }
    const amt = new Prisma.Decimal(t.amount);
    if (t.kind === TransactionKind.INCOME || t.kind === TransactionKind.REIMBURSEMENT || t.kind === TransactionKind.DEBT_IN) {
      if (t.status === TransactionStatus.DONE || t.status === TransactionStatus.PARTIAL) {
        const actual = t.status === TransactionStatus.PARTIAL
          ? t.facts.reduce((a, f) => a.plus(f.amount), new Prisma.Decimal(0))
          : amt;
        // Суммируем только RUB для отображения в дне (мультивалюта в день-тотал — слишком плотно)
        if (t.currencyCode === "RUB") inflowTotal = inflowTotal.plus(actual);
      }
    } else if (t.kind === TransactionKind.EXPENSE || t.kind === TransactionKind.LOAN_PAYMENT || t.kind === TransactionKind.DEBT_OUT) {
      if (t.status === TransactionStatus.DONE || t.status === TransactionStatus.PARTIAL) {
        const actual = t.status === TransactionStatus.PARTIAL
          ? t.facts.reduce((a, f) => a.plus(f.amount), new Prisma.Decimal(0))
          : amt;
        if (t.currencyCode === "RUB") outflowTotal = outflowTotal.plus(actual);
      }
    }
  }

  const totals: TxnDayTotal[] = [];
  const hasInflowKind = txns.some(
    (t) =>
      t.kind === TransactionKind.INCOME ||
      t.kind === TransactionKind.REIMBURSEMENT ||
      t.kind === TransactionKind.DEBT_IN,
  );
  if (!inflowTotal.isZero() || plannedCount > 0 || hasInflowKind) {
    totals.push({
      label: "приток",
      value: `+${formatRub(inflowTotal)}`,
      tone: "pos",
    });
  }
  if (!outflowTotal.isZero()) {
    totals.push({
      label: "отток",
      value: `−${formatRub(outflowTotal)}`,
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
  return totals;
}

function formatRub(amount: Prisma.Decimal): string {
  const base = formatAmount(amount, RUB_SHAPE);
  const [num, sym] = splitTail(base);
  return `${sym} ${num}`;
}

export function toTxnDayView(raw: TxnDayRaw, today: Date): TxnDayView {
  const d = new Date(raw.date + "T00:00:00Z");
  return {
    date: formatDateRu(d),
    weekday: formatWeekdayRu(d, today),
    totals: dayTotalsFromTxns(raw.txns),
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
