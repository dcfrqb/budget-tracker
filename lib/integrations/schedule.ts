// ─────────────────────────────────────────────────────────────
// Schedule policy for integration sync runs.
//
// This module is the single source of truth for "how often should
// each adapter sync". Cron jobs / manual triggers import from here.
//
// Design: policy in code, not in crontab — intervals are typed,
// version-controlled, and enforced at runtime by checkRateLimit().
// ─────────────────────────────────────────────────────────────

import { MIN_INTERVAL_MS_PER_ADAPTER } from "./rate-limit";

export { MIN_INTERVAL_MS_PER_ADAPTER };

/** ±30s jitter to avoid thundering-herd with multiple credentials. */
export const JITTER_MS = 30 * 1000;

const DEFAULT_MIN_INTERVAL_MS = 60_000;

/**
 * Compute when a credential should next be synced.
 *
 * @param adapterId - Adapter identifier (used to look up interval).
 * @param lastRun   - Date of last completed sync, or null if never run.
 * @returns         - Suggested next run Date (with jitter applied).
 */
export function nextScheduledRun(
  adapterId: string,
  lastRun: Date | null,
): Date {
  const minInterval =
    MIN_INTERVAL_MS_PER_ADAPTER[adapterId] ?? DEFAULT_MIN_INTERVAL_MS;
  const base = lastRun ? lastRun.getTime() + minInterval : Date.now();
  // Jitter: random value in [-JITTER_MS, +JITTER_MS]
  const jitter = (Math.random() * 2 - 1) * JITTER_MS;
  return new Date(base + jitter);
}
