import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { AccountForm } from "@/components/forms/account-form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditAccountPage({ params }: Props) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  const [account, institutions, currencies] = await Promise.all([
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
      },
    }),
    db.institution.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
    db.currency.findMany({ orderBy: { code: "asc" } }),
  ]);

  if (!account) notFound();

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
          balance: account.balance.toString(),
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
    </div>
  );
}
