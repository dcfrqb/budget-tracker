"use server";

import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/api/auth";
import { getLatestRatesMap } from "@/lib/data/wallet";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { formatMoney } from "@/lib/format/money";
import { Prisma } from "@prisma/client";
import { breakCompensationSchema } from "@/lib/validation/compensations";

export type CompensationGroupDetail = {
  groupId: string;
  nettoAmount: string;
  nettoFxEquiv?: string;
  membersCount: number;
  members: Array<{
    id: string;
    time: string;
    date: string;
    kind: "inc" | "exp" | "xfr" | "loan";
    amount: string;
    account: string;
    cat: string;
    note?: string;
  }>;
};

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

function formatTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDate(d: Date): string {
  const day = pad2(d.getUTCDate());
  const mon = pad2(d.getUTCMonth() + 1);
  return `${day}.${mon}`;
}

function kindShort(kind: string): "inc" | "exp" | "xfr" | "loan" {
  switch (kind) {
    case "INCOME":
    case "REIMBURSEMENT":
      return "inc";
    case "EXPENSE":
      return "exp";
    case "TRANSFER":
      return "xfr";
    default:
      return "loan";
  }
}

export async function getCompensationGroupDetail(
  groupId: string,
): Promise<{ ok: true; data: CompensationGroupDetail } | { ok: false; error: string }> {
  const parsed = breakCompensationSchema.safeParse({ groupId });
  if (!parsed.success) {
    return { ok: false, error: "transactions.compensation.error.invalid_group" };
  }

  const userId = await getCurrentUserId();

  const group = await db.compensationGroup.findFirst({
    where: { id: groupId, userId },
    select: {
      id: true,
      nettoBase: true,
      nettoSign: true,
      baseCcy: true,
      mainTxnId: true,
      transactions: {
        where: { deletedAt: null },
        select: {
          id: true,
          kind: true,
          amount: true,
          currencyCode: true,
          occurredAt: true,
          note: true,
          account: { select: { name: true, institution: { select: { name: true } } } },
          category: { select: { name: true } },
          currency: { select: { symbol: true, decimals: true, code: true } },
        },
      },
    },
  });

  if (!group) {
    return { ok: false, error: "transactions.selection.error.transfer_not_found" };
  }

  const rates = await getLatestRatesMap();
  const baseCcy = DEFAULT_CURRENCY;
  const nettoBase = new Prisma.Decimal(group.nettoBase);

  // Find the main transaction to get its native currency
  const mainTxn = group.transactions.find((t) => t.id === group.mainTxnId);
  const nativeCcy = mainTxn?.currencyCode ?? baseCcy;

  // Compute netto in native ccy
  let nettoNative: Prisma.Decimal = nettoBase;
  if (nativeCcy !== baseCcy) {
    const rateKey = `${nativeCcy}-${baseCcy}`;
    const inverseKey = `${baseCcy}-${nativeCcy}`;
    const fwdRate = rates.get(rateKey);
    if (fwdRate && !fwdRate.isZero()) {
      nettoNative = nettoBase.div(fwdRate);
    } else {
      const invRate = rates.get(inverseKey);
      if (invRate) {
        nettoNative = nettoBase.mul(invRate);
      }
    }
  }

  const nettoSign = group.nettoSign === 1 ? "+" : "−";
  const nettoAmount = `${nettoSign}${formatMoney(nettoNative, nativeCcy)}`;
  const nettoFxEquiv =
    nativeCcy !== baseCcy
      ? formatMoney(new Prisma.Decimal(nettoBase.toFixed(0)), baseCcy, { approx: true })
      : undefined;

  const members = group.transactions.map((t) => {
    const accountName = t.account.institution?.name ?? t.account.name;
    const sign = t.kind === "INCOME" ? "+" : "−";
    const formattedAmount = `${sign}${formatMoney(t.amount, t.currencyCode)}`;
    return {
      id: t.id,
      time: formatTime(t.occurredAt),
      date: formatDate(t.occurredAt),
      kind: kindShort(t.kind),
      amount: formattedAmount,
      account: accountName,
      cat: t.category?.name ?? "—",
      note: t.note && !t.note.startsWith("import:") ? t.note : undefined,
    };
  });

  return {
    ok: true,
    data: {
      groupId: group.id,
      nettoAmount,
      nettoFxEquiv,
      membersCount: group.transactions.length,
      members,
    },
  };
}
