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

  let credentials: Array<{
    id: string;
    userId: string;
    adapterId: string;
    autosyncEnabled: boolean | null;
    scheduleIntervalMs: number | null;
    leaseUntil: Date | null;
    status: string;
  }>;

  try {
    credentials = await db.integrationCredential.findMany({
      where: {
        autosyncEnabled: true,
        nextScheduledAt: { lte: now },
        status: { not: "DISCONNECTED" },
      },
      select: {
        id: true,
        userId: true,
        adapterId: true,
        autosyncEnabled: true,
        scheduleIntervalMs: true,
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

    const intervalMs =
      cred.scheduleIntervalMs ?? adapter.scheduling.defaultIntervalMs;
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

export type TriggerManualSyncResult =
  | { ok: true; data: { created: number; updated: number; skipped: number; errorClass: string | null; syncLogId?: string } }
  | { ok: false; error: string };

export async function triggerManualSync(
  userId: string,
  credentialId: string,
): Promise<TriggerManualSyncResult> {
  const now = new Date();

  const cred = await db.integrationCredential.findFirst({
    where: { id: credentialId, userId },
    select: {
      id: true,
      adapterId: true,
      scheduleIntervalMs: true,
      leaseUntil: true,
    },
  });

  if (!cred) {
    return { ok: false, error: "credential_not_found" };
  }

  const adapter = getAdapter(cred.adapterId);
  if (!adapter) {
    return { ok: false, error: "unknown_adapter" };
  }

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

  let result: TriggerManualSyncResult;

  try {
    const syncResult = await syncCredential(userId, credentialId) as {
      created?: number;
      updated?: number;
      skipped?: number;
      errorClass?: string | null;
      syncLogId?: string;
    } | undefined;

    result = {
      ok: true,
      data: {
        created: syncResult?.created ?? 0,
        updated: syncResult?.updated ?? 0,
        skipped: syncResult?.skipped ?? 0,
        errorClass: syncResult?.errorClass ?? null,
        syncLogId: syncResult?.syncLogId,
      },
    };
  } catch (err) {
    result = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const intervalMs =
    cred.scheduleIntervalMs ?? adapter.scheduling.defaultIntervalMs;
  const runAt = new Date();

  await db.integrationCredential.update({
    where: { id: credentialId },
    data: {
      lastScheduledRunAt: runAt,
      nextScheduledAt: intervalMs > 0 ? new Date(runAt.getTime() + intervalMs) : null,
      leaseUntil: null,
    },
  }).catch((err) => {
    log.warn(`triggerManualSync: post-sync update failed for ${credentialId}: ${err instanceof Error ? err.message : String(err)}`);
  });

  return result;
}
