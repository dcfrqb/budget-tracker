import { db } from "@/lib/db";

export type AccountLinkRow = {
  id: string;
  externalAccountId: string;
  accountId: string;
  label: string | null;
};

/**
 * Return all IntegrationAccountLink rows for a given credential.
 * No userId guard — callers are responsible for ensuring the credentialId
 * belongs to the current user before calling this.
 */
export async function listAccountLinks(
  credentialId: string,
): Promise<AccountLinkRow[]> {
  return db.integrationAccountLink.findMany({
    where: { credentialId },
    select: {
      id: true,
      externalAccountId: true,
      accountId: true,
      label: true,
    },
  });
}
