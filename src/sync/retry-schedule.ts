/**
 * Back-off for automatic sync retries after a failed attempt (e.g. the server was down while the
 * phone itself had internet). Pure module so the schedule can be unit-tested with plain Node.
 */

/** 30 s, then 1 min, then 5 min; every attempt after that keeps waiting 5 min. */
export const RETRY_DELAYS_MS = [30_000, 60_000, 300_000] as const;

/** Delay before retry number `attempt` (0 = first retry after the first failure). */
export function retryDelayMs(attempt: number): number {
  const index = Math.min(Math.max(0, Math.floor(attempt) || 0), RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[index];
}
