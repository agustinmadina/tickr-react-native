/**
 * Time, injected rather than called directly.
 *
 * The Kotlin project injects a DispatcherProvider for the same reason: a test
 * that has to wait for a real clock is a slow test, and a test that cannot
 * control time cannot test a backoff schedule at all.
 */
export interface Clock {
  now(): number;
  setTimeout(handler: () => void, timeoutMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (handler, timeoutMs) => setTimeout(handler, timeoutMs),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
