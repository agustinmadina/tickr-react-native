/**
 * Exponential, capped.
 *
 * A feed that is down stays down, and hammering it helps nobody. The Kotlin
 * version of this lives at the bottom of CoinbasePriceRepository.kt and is
 * deliberately identical: same initial delay, same cap, same shift ceiling, so
 * the two apps behave the same way against the same exchange.
 */
export const INITIAL_BACKOFF_MS = 1_000;
export const MAX_BACKOFF_MS = 30_000;
const MAX_BACKOFF_SHIFT = 5;

export function backoffMillis(failures: number): number {
  const shift = Math.min(failures, MAX_BACKOFF_SHIFT);
  return Math.min(INITIAL_BACKOFF_MS << shift, MAX_BACKOFF_MS);
}
