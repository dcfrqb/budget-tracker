// ─────────────────────────────────────────────────────────────
// Rate-limit + circuit-breaker for integration sync operations.
//
// checkRateLimit() is the first call in syncCredential().
// Decision is recorded in IntegrationSyncLog regardless of outcome.
// ─────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import type { BankAdapter } from "@/lib/integrations/types";

/** Consecutive ERROR entries before opening circuit. */
export const CIRCUIT_BREAKER_THRESHOLD = 3;

export type RateLimitDecision =
  | { ok: true }
  | { ok: false; reason: "rate_limited"; retryAfterMs: number }
  | { ok: false; reason: "circuit_open"; consecutiveErrors: number };

/**
 * Checks rate limit and circuit-breaker state for a credential.
 *
 * Rate-limit: enforced via credential.lastSyncAt vs adapter.scheduling.minIntervalMs.
 * Circuit-breaker: last N sync logs all ERROR → open circuit.
 *   Resets automatically when any log is OK (or no logs exist).
 */
export async function checkRateLimit(
  credential: {
    id: string;
    adapterId: string;
    lastSyncAt: Date | null;
  },
  adapter: Pick<BankAdapter, "scheduling">,
): Promise<RateLimitDecision> {
  const minIntervalMs = adapter.scheduling.minIntervalMs;

  // ── Rate limit ───────────────────────────────────────────────
  if (credential.lastSyncAt) {
    const elapsedMs = Date.now() - credential.lastSyncAt.getTime();
    if (elapsedMs < minIntervalMs) {
      return {
        ok: false,
        reason: "rate_limited",
        retryAfterMs: minIntervalMs - elapsedMs,
      };
    }
  }

  // ── Circuit breaker ──────────────────────────────────────────
  // Fetch the last CIRCUIT_BREAKER_THRESHOLD completed sync logs.
  // We only look at terminal statuses (not RUNNING entries).
  const recentLogs = await db.integrationSyncLog.findMany({
    where: {
      credentialId: credential.id,
      status: { in: ["ERROR", "OK"] },
    },
    orderBy: { startedAt: "desc" },
    take: CIRCUIT_BREAKER_THRESHOLD,
    select: { status: true },
  });

  // Circuit opens only after CIRCUIT_BREAKER_THRESHOLD failed attempts.
  // Credentials with fewer attempts can keep retrying — this prevents
  // over-aggressive blocking on first-time setup.
  if (recentLogs.length === CIRCUIT_BREAKER_THRESHOLD) {
    const allErrors = recentLogs.every((l) => l.status === "ERROR");
    if (allErrors) {
      return {
        ok: false,
        reason: "circuit_open",
        consecutiveErrors: CIRCUIT_BREAKER_THRESHOLD,
      };
    }
  }

  return { ok: true };
}
