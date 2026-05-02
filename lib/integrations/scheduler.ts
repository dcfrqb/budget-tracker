import { db } from "@/lib/db";
import { getAdapter } from "@/lib/integrations/registry";
import { syncCredential } from "@/lib/data/_mutations/integrations";
import {
  SCHEDULER_TICK_MS,
  SCHEDULER_BOOT_DELAY_MS,
  LEASE_BUFFER_MULTIPLIER,
  LEASE_MAX_MS,
} from "@/lib/integrations/scheduler-config";

let started = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

const log = {
  info: (msg: string) => console.log(`[scheduler] ${msg}`),
  warn: (msg: string) => console.warn(`[scheduler] ${msg}`),
};

async function tick(): Promise<void> {
  const now = new Date();
  log.info(`tick start ts=${now.toISOString()}`);

  // Fetch all users' global autosync cadence from BudgetSettings
  let settingsList: Array<{ userId: string; autosyncIntervalMs: number | null }>;
  try {
    settingsList = await db.budgetSettings.findMany({
      where: { autosyncIntervalMs: { not: null } },
      select: { userId: true, autosyncIntervalMs: true },
    });
  } catch (err) {
    log.warn(`tick: budgetSettings query failed: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  if (settingsList.length === 0) {
    log.info(`tick: no users with autosync enabled`);
    return;
  }

  const userIntervalMap = new Map(settingsList.map((s) => [s.userId, s.autosyncIntervalMs!]));

  let credentials: Array<{
    id: string;
    userId: string;
    adapterId: string;
    leaseUntil: Date | null;
    status: string;
  }>;

  try {
    credentials = await db.integrationCredential.findMany({
      where: {
        userId: { in: [...userIntervalMap.keys()] },
        nextScheduledAt: { lte: now },
        status: { not: "DISCONNECTED" },
      },
      select: {
        id: true,
        userId: true,
        adapterId: true,
        leaseUntil: true,
        status: true,
      },
    });
  } catch (err) {
    log.warn(`tick: db query failed: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  log.info(`tick: found ${credentials.length} due credential(s)`);

  for (const cred of credentials) {
    const adapter = getAdapter(cred.adapterId);

    if (!adapter) {
      log.warn(`tick: unknown adapterId=${cred.adapterId} credentialId=${cred.id} — skipping`);
      continue;
    }

    if (!adapter.scheduling.autosyncEnabled) {
      // Adapter-level guard: CSV adapters should never autosync. Clear the scheduled run.
      await db.integrationCredential.update({
        where: { id: cred.id },
        data: { nextScheduledAt: null },
      }).catch((err) => {
        log.warn(`tick: failed to clear nextScheduledAt for ${cred.id}: ${err instanceof Error ? err.message : String(err)}`);
      });
      continue;
    }

    // Try to take lease via conditional updateMany
    const leaseDuration = Math.min(
      adapter.scheduling.minIntervalMs * LEASE_BUFFER_MULTIPLIER,
      LEASE_MAX_MS,
    );
    const leaseExpiry = new Date(Date.now() + leaseDuration);

    const leaseResult = await db.integrationCredential.updateMany({
      where: {
        id: cred.id,
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: { leaseUntil: leaseExpiry },
    }).catch((err) => {
      log.warn(`tick: lease attempt failed for ${cred.id}: ${err instanceof Error ? err.message : String(err)}`);
      return { count: 0 };
    });

    if (leaseResult.count === 0) {
      log.info(`tick: credentialId=${cred.id} already leased — skipping`);
      continue;
    }

    log.info(`tick: running sync for credentialId=${cred.id} adapterId=${cred.adapterId}`);

    try {
      await syncCredential(cred.userId, cred.id);
    } catch (err) {
      log.warn(`tick: sync error credentialId=${cred.id}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Use global cadence from BudgetSettings (ignore per-credential scheduleIntervalMs)
    const intervalMs = userIntervalMap.get(cred.userId) ?? adapter.scheduling.defaultIntervalMs;
    const runAt = new Date();

    await db.integrationCredential.update({
      where: { id: cred.id },
      data: {
        lastScheduledRunAt: runAt,
        nextScheduledAt: new Date(runAt.getTime() + intervalMs),
        leaseUntil: null,
      },
    }).catch((err) => {
      log.warn(`tick: post-sync update failed for ${cred.id}: ${err instanceof Error ? err.message : String(err)}`);
    });

    log.info(`tick: done credentialId=${cred.id} nextIn=${intervalMs}ms`);
  }

  log.info(`tick end`);
}

export function startScheduler(): void {
  if (started) return;
  started = true;

  log.info("starting — boot delay " + SCHEDULER_BOOT_DELAY_MS + "ms");

  setTimeout(() => {
    tick().catch((err) => {
      log.warn(`boot tick error: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, SCHEDULER_BOOT_DELAY_MS);

  intervalHandle = setInterval(() => {
    tick().catch((err) => {
      log.warn(`interval tick error: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, SCHEDULER_TICK_MS);
}

export function stopScheduler(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  started = false;
}

// ─────────────────────────────────────────────────────────────
// Enqueue a single manual sync (non-blocking, fire-and-forget)
// ─────────────────────────────────────────────────────────────

export type EnqueueResult =
  | { ok: true; jobId: string }
  | { ok: false; error: string };

export async function enqueueManualSync(
  userId: string,
  credentialId: string,
): Promise<EnqueueResult> {
  const now = new Date();

  const cred = await db.integrationCredential.findFirst({
    where: { id: credentialId, userId },
    select: { id: true, adapterId: true, leaseUntil: true, status: true },
  });

  if (!cred) return { ok: false, error: "credential_not_found" };
  if (cred.status === "DISCONNECTED") return { ok: false, error: "not_connected" };

  const adapter = getAdapter(cred.adapterId);
  if (!adapter) return { ok: false, error: "unknown_adapter" };

  const leaseDuration = Math.min(
    adapter.scheduling.minIntervalMs * LEASE_BUFFER_MULTIPLIER,
    LEASE_MAX_MS,
  );
  const leaseExpiry = new Date(now.getTime() + leaseDuration);

  const leaseResult = await db.integrationCredential.updateMany({
    where: {
      id: credentialId,
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
    },
    data: { leaseUntil: leaseExpiry },
  });

  if (leaseResult.count === 0) {
    return { ok: false, error: "busy" };
  }

  // Create RUNNING log entry synchronously so callers can poll it
  const syncLog = await db.integrationSyncLog.create({
    data: { credentialId, status: "RUNNING" },
  });

  const jobId = syncLog.id;

  // Fire and forget — errors are caught and written to the log row.
  // Pass jobId so syncCredential reuses the placeholder row instead of
  // creating its own, preventing orphan RUNNING rows.
  void Promise.resolve().then(async () => {
    try {
      await syncCredential(userId, credentialId, { logId: jobId });
    } catch (err) {
      const errorClass = err instanceof Error ? err.message.split(":")[0].slice(0, 40) : "unknown";
      try {
        await db.integrationSyncLog.update({
          where: { id: jobId },
          data: {
            status: "ERROR",
            finishedAt: new Date(),
            errorClass,
          },
        });
      } catch {
        // ignore — best effort
      }
    }

    // Release lease; update lastScheduledRunAt
    const runAt = new Date();
    const budgetSettings = await db.budgetSettings.findFirst({
      where: { userId },
      select: { autosyncIntervalMs: true },
    }).catch(() => null);

    const intervalMs =
      budgetSettings?.autosyncIntervalMs ?? adapter.scheduling.defaultIntervalMs;

    await db.integrationCredential.update({
      where: { id: credentialId },
      data: {
        lastScheduledRunAt: runAt,
        nextScheduledAt: intervalMs > 0 ? new Date(runAt.getTime() + intervalMs) : null,
        leaseUntil: null,
      },
    }).catch((e) => {
      log.warn(`enqueueManualSync: post-sync update failed for ${credentialId}: ${e instanceof Error ? e.message : String(e)}`);
    });
  });

  return { ok: true, jobId };
}

// ─────────────────────────────────────────────────────────────
// Enqueue sync for all connected credentials of a user
// ─────────────────────────────────────────────────────────────

export type EnqueueAllResult = {
  jobIds: string[];
  skipped: Array<{ credentialId: string; reason: "lease-held" | "not-connected" }>;
};

export async function enqueueSyncAll(userId: string): Promise<EnqueueAllResult> {
  const credentials = await db.integrationCredential.findMany({
    where: { userId, status: { not: "DISCONNECTED" } },
    select: { id: true },
  });

  const jobIds: string[] = [];
  const skipped: EnqueueAllResult["skipped"] = [];

  for (const cred of credentials) {
    const result = await enqueueManualSync(userId, cred.id);
    if (result.ok) {
      jobIds.push(result.jobId);
    } else {
      const reason =
        result.error === "busy"
          ? "lease-held"
          : "not-connected";
      skipped.push({ credentialId: cred.id, reason });
    }
  }

  return { jobIds, skipped };
}

// ─────────────────────────────────────────────────────────────
// Legacy wrapper — kept for callers that still call triggerManualSync.
// Now non-blocking; returns immediately.
// ─────────────────────────────────────────────────────────────

export type TriggerManualSyncResult =
  | { ok: true; data: { created: number; updated: number; skipped: number; errorClass: string | null; syncLogId?: string } }
  | { ok: false; error: string };

/** @deprecated Use enqueueManualSync instead. */
export async function triggerManualSync(
  userId: string,
  credentialId: string,
): Promise<TriggerManualSyncResult> {
  const result = await enqueueManualSync(userId, credentialId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return {
    ok: true,
    data: { created: 0, updated: 0, skipped: 0, errorClass: null, syncLogId: result.jobId },
  };
}
