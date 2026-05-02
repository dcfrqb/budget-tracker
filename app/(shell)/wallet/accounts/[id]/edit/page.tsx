import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { AccountForm } from "@/components/forms/account-form";
import { AccountRequisites } from "@/components/wallet/account-requisites";
import { pullRequisitesAction } from "./actions";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditAccountPage({ params }: Props) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  const [account, institutions, currencies, integrationLink] = await Promise.all([
    db.account.findFirst({
      where: { id, userId, deletedAt: null },
      select: {
        id: true,
        institutionId: true,
        kind: true,
        name: true,
        currencyCode: true,
        balance: true,
        sub: true,
        sortOrder: true,
        includeInAnalytics: true,
        subtype: true,
        customPillLabel: true,
        // CREDIT fields
        creditRatePct: true,
        creditLimit: true,
        gracePeriodDays: true,
        statementDay: true,
        minPaymentPercent: true,
        minPaymentFixed: true,
        // SAVINGS fields
        annualRatePct: true,
        savingsCapitalization: true,
        withdrawalLimit: true,
        // Card linking
        cardLast4: true,
        // Bank requisites
        accountNumber: true,
        bic: true,
        bankName: true,
        inn: true,
        kpp: true,
        correspondentAccount: true,
        recipientName: true,
        paymentDueDay: true,
      },
    }),
    db.institution.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
    db.currency.findMany({ orderBy: { code: "asc" } }),
    db.integrationAccountLink.findFirst({
      where: { accountId: id },
      select: { id: true },
    }),
  ]);

  if (!account) notFound();

  const hasIntegration = integrationLink !== null;

  return (
    <div className="page-content">
      <AccountForm
        variant="page"
        mode="edit"
        accountId={id}
        institutions={institutions.map((i) => ({
          id: i.id,
          name: i.name,
          kind: i.kind,
        }))}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol }))}
        initialValues={{
          institutionId: account.institutionId ?? undefined,
          kind: account.kind,
          name: account.name,
          currencyCode: account.currencyCode,
          // Credit card: stored balance = available − creditLimit. Show available in edit form.
          balance: account.kind === "CREDIT" && account.creditLimit != null
            ? account.creditLimit.plus(account.balance).toString()
            : account.balance.toString(),
          sub: account.sub ?? undefined,
          sortOrder: account.sortOrder,
          includeInAnalytics: account.includeInAnalytics,
          // CREDIT fields
          creditRatePct: account.creditRatePct?.toString() ?? undefined,
          creditLimit: account.creditLimit?.toString() ?? undefined,
          gracePeriodDays: account.gracePeriodDays ?? undefined,
          statementDay: account.statementDay ?? undefined,
          minPaymentPercent: account.minPaymentPercent?.toString() ?? undefined,
          minPaymentFixed: account.minPaymentFixed?.toString() ?? undefined,
          // SAVINGS fields
          annualRatePct: account.annualRatePct?.toString() ?? undefined,
          savingsCapitalization: account.savingsCapitalization ?? undefined,
          withdrawalLimit: account.withdrawalLimit?.toString() ?? undefined,
          // Card linking
          cardLast4: account.cardLast4 ?? [],
          // Bank requisites — coerce null→"" so text inputs bind as empty string
          accountNumber: account.accountNumber ?? "",
          bic: account.bic ?? "",
          bankName: account.bankName ?? "",
        }}
      />
      <AccountRequisites
        account={{
          id: account.id,
          inn: account.inn,
          kpp: account.kpp,
          correspondentAccount: account.correspondentAccount,
          accountNumber: account.accountNumber,
          bic: account.bic,
          bankName: account.bankName,
          recipientName: account.recipientName ?? null,
        }}
        hasIntegration={hasIntegration}
        pullAction={pullRequisitesAction.bind(null, id)}
      />
    </div>
  );
}
