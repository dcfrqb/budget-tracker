import { db } from "@/lib/db";

/**
 * Wipes all user data in a single transaction.
 * Preserves: User record itself, Currency catalog, BudgetSettings (reset to defaults).
 * FK-dependency order matters: leaf tables deleted first, then their parents.
 */
export async function wipeAllUserData(userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    // 0. IntegrationCredential references User (FK) — delete before user-scoped data
    await tx.integrationCredential.deleteMany({ where: { userId } });

    // 1. ReimbursementFact and TransactionFact reference Transaction (Cascade, but explicit for safety)
    await tx.reimbursementFact.deleteMany({
      where: { transaction: { userId } },
    });
    await tx.transactionFact.deleteMany({
      where: { transaction: { userId } },
    });

    // 2. SubscriptionShares reference Subscription
    await tx.subscriptionShare.deleteMany({
      where: { subscription: { userId } },
    });

    // 3. LoanPayments reference Loan
    await tx.loanPayment.deleteMany({
      where: { loan: { userId } },
    });

    // 4. Transactions (must go before their parents so FK constraints don't fire)
    await tx.transaction.deleteMany({ where: { userId } });

    // 5. Transfers
    await tx.transfer.deleteMany({ where: { userId } });

    // 6. Domain entities
    await tx.loan.deleteMany({ where: { userId } });
    await tx.subscription.deleteMany({ where: { userId } });
    await tx.longProject.deleteMany({ where: { userId } });
    await tx.personalDebt.deleteMany({ where: { userId } });

    // 7. PlannedEvents reference Fund
    await tx.plannedEvent.deleteMany({ where: { userId } });
    await tx.fund.deleteMany({ where: { userId } });

    // 8. WorkSources
    await tx.workSource.deleteMany({ where: { userId } });

    // 9. Family (FamilyMember rows cascade from Family)
    await tx.familyMember.deleteMany({ where: { userId } });
    await tx.family.deleteMany({ where: { ownerId: userId } });

    // 10. Categories (children before parents via self-reference; deleteMany handles it with Cascade)
    await tx.category.deleteMany({ where: { userId } });

    // 11. Accounts before Institutions
    await tx.account.deleteMany({ where: { userId } });
    await tx.institution.deleteMany({ where: { userId } });

    // 12. Reset BudgetSettings to defaults
    await tx.budgetSettings.upsert({
      where: { userId },
      create: {
        userId,
        activeMode: "NORMAL",
        primaryCurrencyCode: "RUB",
      },
      update: {
        activeMode: "NORMAL",
        primaryCurrencyCode: "RUB",
      },
    });
  });
}
