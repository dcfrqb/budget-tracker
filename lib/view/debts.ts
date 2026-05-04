import { Prisma } from "@prisma/client";
import type { DebtWithTxns, DebtProgress } from "@/lib/data/debts";
import { formatMoney } from "@/lib/format/money";
import { formatDateRu } from "@/lib/view/transactions";
import type { TKey } from "@/lib/i18n/t";

type TFn = (key: TKey, options?: { vars?: Record<string, string | number> }) => string;

export type DebtView = {
  id: string;
  dir: "out" | "in";
  dirLabel: string;
  name: string;
  sub: string;
  since: string;
  until: string;
  amount: string;
  amountTone: "pos" | "neg";
  progressPct: number;
  progressLabel: string;
};


function returnsSuffix(n: number, t: TFn): string {
  if (n === 1) return t("debts.returns_suffix.one");
  if (n < 5) return t("debts.returns_suffix.few");
  return t("debts.returns_suffix.many");
}

export function toDebtView(
  debt: DebtWithTxns & DebtProgress,
  t: TFn,
): DebtView {
  const dir = debt.direction === "LENT" ? "out" : "in";
  const dirLabel = dir === "out" ? t("debts.dir.out") : t("debts.dir.in");
  const amountTone = dir === "out" ? "pos" : "neg";

  const principal = new Prisma.Decimal(debt.principal);
  const returned = debt.returnedAmount;

  const name = `${debt.counterparty}${debt.note ? ` · ${debt.note}` : ""}`;

  const sub = debt.nextExpected
    ? debt.nextExpected.plannedAt
      ? t("debts.next_payment", {
          vars: {
            amount: formatMoney(debt.nextExpected.amount, debt.currency.code),
            date: formatDateRu(debt.nextExpected.plannedAt),
          },
        })
      : t("debts.next_payment_no_date", {
          vars: {
            amount: formatMoney(debt.nextExpected.amount, debt.currency.code),
          },
        })
    : debt.returnsCount > 0
      ? t("debts.returns_count", {
          vars: {
            n: String(debt.returnsCount),
            suffix: returnsSuffix(debt.returnsCount, t),
          },
        })
      : t("debts.no_returns");

  const since = formatDateRu(debt.openedAt);
  const until = debt.dueAt ? formatDateRu(debt.dueAt) : t("common.no_deadline");

  const amtSign = dir === "out" ? "−" : "+";
  const amountFormatted = formatMoney(principal, debt.currency.code);
  const amount = `${amtSign}${amountFormatted}`;

  const progressLabel = t("debts.progress_label", {
    vars: {
      returned: String(Math.floor(returned.toNumber())),
      total: String(Math.floor(principal.toNumber())),
    },
  });

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
