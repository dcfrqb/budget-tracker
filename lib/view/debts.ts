import { Prisma } from "@prisma/client";
import type { DebtWithTxns, DebtProgress } from "@/lib/data/debts";
import { formatAmount } from "@/lib/format/money";
import { formatDateRu } from "@/lib/view/transactions";

export type DebtView = {
  id: string;
  dir: "out" | "in";
  dirLabel: "выдал" | "взял";
  name: string;
  sub: string;
  since: string;
  until: string;
  amount: string;
  amountTone: "pos" | "neg";
  progressPct: number;
  progressLabel: string;
};

function reverseSymbol(formatted: string): string {
  const idx = formatted.lastIndexOf(" ");
  return `${formatted.slice(idx + 1)} ${formatted.slice(0, idx)}`;
}

export function toDebtView(debt: DebtWithTxns & DebtProgress): DebtView {
  const dir = debt.direction === "LENT" ? "out" : "in";
  const dirLabel = dir === "out" ? "выдал" : "взял";
  const amountTone = dir === "out" ? "neg" : "pos";

  const principal = new Prisma.Decimal(debt.principal);
  const returned = debt.returnedAmount;

  const name = `${debt.counterparty}${debt.note ? ` · ${debt.note}` : ""}`;

  const sub = debt.nextExpected
    ? `следующий ${reverseSymbol(formatAmount(debt.nextExpected.amount, debt.currency))} на ${
        debt.nextExpected.plannedAt ? formatDateRu(debt.nextExpected.plannedAt) : "—"
      }`
    : debt.returnsCount > 0
      ? `${debt.returnsCount} возврат${debt.returnsCount === 1 ? "" : debt.returnsCount < 5 ? "а" : "ов"}`
      : "без возвратов";

  const since = formatDateRu(debt.openedAt);
  const until = debt.dueAt ? formatDateRu(debt.dueAt) : "без срока";

  // Для OUT знак "−" (деньги ушли), для IN — "+" (деньги пришли).
  const amtSign = dir === "out" ? "−" : "+";
  const amountFormatted = reverseSymbol(formatAmount(principal, debt.currency));
  const amount = `${amtSign}${amountFormatted}`;

  // Прогресс-лейбл: для OUT показываем возвращено / principal, для IN тоже.
  const progressLabel = `возвращено ${Math.floor(returned.toNumber())} / ${Math.floor(principal.toNumber())}`;

  return {
    id: debt.id,
    dir,
    dirLabel,
    name,
    sub,
    since,
    until,
    amount,
    amountTone,
    progressPct: debt.progressPct,
    progressLabel,
  };
}
