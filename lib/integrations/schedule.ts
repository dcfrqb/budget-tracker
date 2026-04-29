// ─────────────────────────────────────────────────────────────
// Schedule policy for integration sync runs.
//
// Adapter-specific intervals now live on each adapter's scheduling.minIntervalMs.
// This module is kept for the nextScheduledRun helper used by callers
// that compute suggested next-run dates with jitter.
// ─────────────────────────────────────────────────────────────

import { getAdapter } from "@/lib/integrations/registry";

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
  const adapter = getAdapter(adapterId);
  const minInterval = adapter?.scheduling.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  const base = lastRun ? lastRun.getTime() + minInterval : Date.now();
  // Jitter: random value in [-JITTER_MS, +JITTER_MS]
  const jitter = (Math.random() * 2 - 1) * JITTER_MS;
  return new Date(base + jitter);
}
