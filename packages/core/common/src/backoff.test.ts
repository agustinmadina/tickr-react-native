import { describe, expect, it } from 'vitest';

import { INITIAL_BACKOFF_MS, MAX_BACKOFF_MS, backoffMillis } from './backoff';

/**
 * The backoff curve, tested against the Kotlin values.
 *
 * These are the numbers from CoinbasePriceRepository.kt, and the test exists
 * because the curve is the difference between a dropped feed that recovers in a
 * second and one that hammers the endpoint forty times a second. The cap is the
 * part that matters: an uncapped exponential reaches minutes within a handful of
 * failures and the feed never comes back.
 */
describe('backoffMillis', () => {
  it('starts at the initial delay', () => {
    expect(backoffMillis(0)).toBe(INITIAL_BACKOFF_MS);
  });

  it('doubles per failure', () => {
    expect(backoffMillis(1)).toBe(INITIAL_BACKOFF_MS * 2);
    expect(backoffMillis(2)).toBe(INITIAL_BACKOFF_MS * 4);
    expect(backoffMillis(3)).toBe(INITIAL_BACKOFF_MS * 8);
  });

  it('caps at the maximum', () => {
    expect(backoffMillis(50)).toBe(MAX_BACKOFF_MS);
    expect(backoffMillis(1_000)).toBe(MAX_BACKOFF_MS);
  });

  it('never exceeds the cap at any shift', () => {
    for (let failures = 0; failures < 100; failures += 1) {
      expect(backoffMillis(failures)).toBeLessThanOrEqual(MAX_BACKOFF_MS);
    }
  });

  it('is monotonic', () => {
    let previous = 0;
    for (let failures = 0; failures < 20; failures += 1) {
      const current = backoffMillis(failures);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});
