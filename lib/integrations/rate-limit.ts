// ─────────────────────────────────────────────────────────────
// Rate-limit + circuit-breaker for integration sync operations.
//
// checkRateLimit() is the first call in syncCredential().
// Decision is recorded in IntegrationSyncLog regardless of outcome.
//
// Circuit-breaker behavior:
//   - Only "real" sync outcomes count (ERROR/OK). Rows with
//     errorClass in ("circuit_open","rate_limited") are excluded so a
//     rejection can never hold the breaker open on its own.
//   - After CIRCUIT_BREAKER_THRESHOLD consecutive real ERRORs the
//     circuit opens. Once the most-recent real ERROR is older than
//     CIRCUIT_HALF_OPEN_COOLDOWN_MS the breaker enters half-open and
//     allows one trial attempt. A successful trial (OK) closes the
//     breaker naturally; a failed trial resets the cooldown clock.
// ─────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import type { BankAdapter } from "@/lib/integrations/types";

/** Consecutive real-ERROR entries before opening circuit. */
export const CIRCUIT_BREAKER_THRESHOLD = 5;

/**
 * After the circuit opens, how long to wait before allowing one
 * trial attempt (half-open state). 1 hour.
 */
export const CIRCUIT_HALF_OPEN_COOLDOWN_MS = 60 * 60 * 1000;

export type RateLimitDecision =
  | { ok: true; halfOpen?: boolean }
  | { ok: false; reason: "rate_limited"; retryAfterMs: number }
  | { ok: false; reason: "circuit_open"; consecutiveErrors: number };

/**
 * Checks rate limit and circuit-breaker state for a credential.
 *
 * Rate-limit: enforced via credential.lastSyncAt vs adapter.scheduling.minIntervalMs.
 * Circuit-breaker: last N real sync logs all ERROR → open circuit.
 *   Rejection logs (errorClass circuit_open / rate_limited) are excluded from
 *   the basis so they cannot self-perpetuate the open state.
 *   Half-open: after CIRCUIT_HALF_OPEN_COOLDOWN_MS since the newest real ERROR
 *   the breaker allows one trial attempt, then re-evaluates on the result.
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
  // Fetch the last CIRCUIT_BREAKER_THRESHOLD real sync outcomes.
  // Exclude breaker/rate-limit rejection logs — they must never
  // count as genuine failures that hold the breaker open.
  const recentLogs = await db.integrationSyncLog.findMany({
    where: {
      credentialId: credential.id,
      status: { in: ["ERROR", "OK"] },
      OR: [
        { errorClass: null },
        { errorClass: { notIn: ["circuit_open", "rate_limited", "transient_retried"] } },
      ],
    },
    orderBy: { startedAt: "desc" },
    take: CIRCUIT_BREAKER_THRESHOLD,
    select: { status: true, startedAt: true },
  });

  // Circuit opens only after CIRCUIT_BREAKER_THRESHOLD failed attempts.
  // Credentials with fewer real attempts can keep retrying — this prevents
  // over-aggressive blocking on first-time setup.
  if (recentLogs.length === CIRCUIT_BREAKER_THRESHOLD) {
    const allErrors = recentLogs.every((l) => l.status === "ERROR");
    if (allErrors) {
      // Half-open: if the most recent real error is older than the cooldown
      // window, allow one trial attempt instead of hard-rejecting.
      const newestError = recentLogs[0]; // ordered desc, so index 0 is newest
      const ageMs = Date.now() - newestError.startedAt.getTime();
      if (ageMs > CIRCUIT_HALF_OPEN_COOLDOWN_MS) {
        return { ok: true, halfOpen: true };
      }

      return {
        ok: false,
        reason: "circuit_open",
        consecutiveErrors: CIRCUIT_BREAKER_THRESHOLD,
      };
    }
  }

  return { ok: true };
}
