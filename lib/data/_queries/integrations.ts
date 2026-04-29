import { cache } from "react";
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

// ─────────────────────────────────────────────────────────────
// Connected credentials for top-bar sync button.
// No assertAdminIntegrations guard — safe to call from any layout.
// Returns empty array when ADMIN_INTEGRATIONS !== "true".
// ─────────────────────────────────────────────────────────────

export type ConnectedCredentialRow = {
  id: string;
  adapterId: string;
  displayLabel: string | null;
  lastSyncAt: Date | null;
  lastErrorAt: Date | null;
};

export const getConnectedCredentials = cache(async (
  userId: string,
): Promise<ConnectedCredentialRow[]> => {
  if (process.env.ADMIN_INTEGRATIONS !== "true") return [];
  const rows = await db.integrationCredential.findMany({
    where: { userId, status: { not: "DISCONNECTED" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      adapterId: true,
      displayLabel: true,
      lastSyncAt: true,
      lastErrorAt: true,
    },
  });
  // Only show credentials whose adapter can be triggered for sync from the UI.
  // CSV / email adapters live in the integrations page but have no "Sync now"
  // semantics — including them in the popover would surface confusing errors.
  const { getAdapter } = await import("@/lib/integrations/registry");
  return rows.filter((r) => {
    const a = getAdapter(r.adapterId);
    return Boolean(a?.supports.fetchTransactions);
  });
});

// ─────────────────────────────────────────────────────────────
// Integrations summary for right-rail session block.
// Wrapped in react.cache so parallel calls are deduplicated.
// ─────────────────────────────────────────────────────────────

export type IntegrationsSummary = {
  totalConnected: number;
  lastSyncAt: Date | null;
  hasError: boolean;
};

export const getIntegrationsSummary = cache(async (
  userId: string,
): Promise<IntegrationsSummary> => {
  if (process.env.ADMIN_INTEGRATIONS !== "true") {
    return { totalConnected: 0, lastSyncAt: null, hasError: false };
  }

  const rows = await db.integrationCredential.findMany({
    where: { userId, status: { not: "DISCONNECTED" } },
    select: { lastSyncAt: true, lastErrorAt: true },
  });

  if (rows.length === 0) {
    return { totalConnected: 0, lastSyncAt: null, hasError: false };
  }

  const now = Date.now();
  const H24 = 24 * 60 * 60 * 1000;
  let hasError = false;
  let latestSync: Date | null = null;

  for (const r of rows) {
    if (r.lastErrorAt && now - r.lastErrorAt.getTime() < H24) {
      hasError = true;
    }
    if (r.lastSyncAt) {
      if (!latestSync || r.lastSyncAt > latestSync) latestSync = r.lastSyncAt;
    }
  }

  return {
    totalConnected: rows.length,
    lastSyncAt: latestSync,
    hasError,
  };
});
