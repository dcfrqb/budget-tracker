import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// Recursively converts Decimal and Date values to plain serializable types.
function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Prisma.Decimal) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v);
    }
    return out;
  }
  return value;
}

export type UserDataBundle = {
  exportedAt: string;
  user: unknown;
  budgetSettings: unknown;
  institutions: unknown[];
  accounts: unknown[];
  categories: unknown[];
  workSources: unknown[];
  transactions: unknown[];
  transfers: unknown[];
  loans: unknown[];
  loanPayments: unknown[];
  subscriptions: unknown[];
  subscriptionShares: unknown[];
  longProjects: unknown[];
  funds: unknown[];
  plannedEvents: unknown[];
  personalDebts: unknown[];
  families: unknown[];
  familyMembers: unknown[];
  /// секреты намеренно исключены (encryptedPayload, encryptionIv, encryptionTag)
  integrationCredentials: unknown[];
};

export async function getUserDataBundle(userId: string): Promise<UserDataBundle> {
  const [
    user,
    budgetSettings,
    institutions,
    accounts,
    categories,
    workSources,
    transactions,
    transfers,
    loans,
    loanPayments,
    subscriptions,
    subscriptionShares,
    longProjects,
    funds,
    plannedEvents,
    personalDebts,
    families,
    familyMembers,
    integrationCredentials,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, gender: true, createdAt: true },
    }),
    db.budgetSettings.findUnique({ where: { userId } }),
    db.institution.findMany({ where: { userId } }),
    db.account.findMany({ where: { userId } }),
    db.category.findMany({ where: { userId } }),
    db.workSource.findMany({ where: { userId } }),
    db.transaction.findMany({ where: { userId }, include: { facts: true, reimbursements: true } }),
    db.transfer.findMany({ where: { userId } }),
    db.loan.findMany({ where: { userId } }),
    db.loanPayment.findMany({ where: { loan: { userId } } }),
    db.subscription.findMany({ where: { userId } }),
    db.subscriptionShare.findMany({ where: { subscription: { userId } } }),
    db.longProject.findMany({ where: { userId } }),
    db.fund.findMany({ where: { userId } }),
    db.plannedEvent.findMany({ where: { userId } }),
    db.personalDebt.findMany({ where: { userId } }),
    db.family.findMany({ where: { ownerId: userId } }),
    db.familyMember.findMany({ where: { userId } }),
    db.integrationCredential.findMany({
      where: { userId },
      select: {
        /// секреты намеренно исключены
        id: true,
        adapterId: true,
        displayLabel: true,
        status: true,
        lastSyncAt: true,
        lastErrorAt: true,
        lastErrorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return serialize({
    exportedAt: new Date().toISOString(),
    user,
    budgetSettings,
    institutions,
    accounts,
    categories,
    workSources,
    transactions,
    transfers,
    loans,
    loanPayments,
    subscriptions,
    subscriptionShares,
    longProjects,
    funds,
    plannedEvents,
    personalDebts,
    families,
    familyMembers,
    integrationCredentials,
  }) as UserDataBundle;
}
