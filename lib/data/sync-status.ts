import { db } from "@/lib/db";

export type SyncStatusItem = {
  credentialId: string;
  isRunning: boolean;
  startedAt: Date | null;
  lastFinishedAt: Date | null;
  lastResult: {
    created: number;
    updated: number;
    skipped: number;
    errorClass: string | null;
  } | null;
};

export async function getSyncStatus(
  userId: string,
  credentialIds: string[],
): Promise<SyncStatusItem[]> {
  if (credentialIds.length === 0) return [];

  // Verify all credentials belong to this user
  const owned = await db.integrationCredential.findMany({
    where: { id: { in: credentialIds }, userId },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((c) => c.id));

  const results: SyncStatusItem[] = [];

  for (const credentialId of credentialIds) {
    if (!ownedIds.has(credentialId)) continue;

    const latest = await db.integrationSyncLog.findFirst({
      where: { credentialId },
      orderBy: { startedAt: "desc" },
      select: {
        status: true,
        startedAt: true,
        finishedAt: true,
        rowsCreated: true,
        rowsSkipped: true,
        errorClass: true,
      },
    });

    if (!latest) {
      results.push({ credentialId, isRunning: false, startedAt: null, lastFinishedAt: null, lastResult: null });
      continue;
    }

    const isRunning = latest.status === "RUNNING" && latest.finishedAt === null;

    results.push({
      credentialId,
      isRunning,
      startedAt: latest.startedAt ?? null,
      lastFinishedAt: latest.finishedAt ?? null,
      lastResult: {
        created: latest.rowsCreated,
        updated: 0,
        skipped: latest.rowsSkipped,
        errorClass: latest.errorClass ?? null,
      },
    });
  }

  return results;
}
