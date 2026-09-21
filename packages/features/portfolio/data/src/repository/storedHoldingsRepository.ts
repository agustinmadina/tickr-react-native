import { type JsonStore } from '@tickr/core-storage';
import { type Holding, type HoldingsRepository } from '@tickr/portfolio-domain';

import { type HoldingsDocument } from '../local/holdingDocument';

const STORAGE_KEY = 'tickr.holdings.v1';

/**
 * Holdings, persisted as a single document.
 *
 * The Kotlin version is StoredHoldingsRepository, and it makes the same choice:
 * a serialised document rather than a table, because a portfolio is a handful
 * of rows read whole and written whole.
 *
 * The stream is a listener set rather than a poll. The Kotlin version gets this
 * from `Settings` plus a `MutableStateFlow`; here it is explicit, because
 * nothing in the storage layer emits on its own.
 */
export function createStoredHoldingsRepository(
  store: JsonStore<HoldingsDocument>,
): HoldingsRepository {
  const listeners = new Set<(holdings: readonly Holding[]) => void>();

  const read = (): readonly Holding[] => store.read()?.holdings ?? [];

  const write = (holdings: readonly Holding[]) => {
    store.write({ version: 1, holdings: [...holdings] });
    for (const listener of listeners) listener(holdings);
  };

  return {
    observeHoldings(): AsyncIterable<readonly Holding[]> {
      return {
        [Symbol.asyncIterator]() {
          const pending: (readonly Holding[])[] = [];
          let wake: (() => void) | null = null;
          let closed = false;

          const push = (holdings: readonly Holding[]) => {
            pending.push(holdings);
            wake?.();
          };

          listeners.add(push);
          push(read());

          return {
            async next(): Promise<IteratorResult<readonly Holding[]>> {
              while (pending.length === 0 && !closed) {
                await new Promise<void>((resolve) => {
                  wake = resolve;
                });
                wake = null;
              }
              const value = pending.shift();
              if (value === undefined) return { done: true, value: undefined };
              return { done: false, value };
            },
            return(): Promise<IteratorResult<readonly Holding[]>> {
              closed = true;
              listeners.delete(push);
              wake?.();
              return Promise.resolve({ done: true, value: undefined });
            },
          };
        },
      };
    },

    // The repository interface returns a Promise so a store with real latency
    // can satisfy it, but both of these are synchronous: storage is synchronous
    // on all three platforms. `Promise.resolve` states that honestly; a bare
    // `async` with nothing to await would be a lie the linter can see.
    add(holding: Holding): Promise<void> {
      const current = read();
      // Replacing rather than appending: adding a symbol that is already held
      // is a correction, not a second position, and two rows for one asset
      // would double-count it in every total.
      const next = current.filter((existing) => existing.symbol !== holding.symbol);
      write([...next, holding]);
      return Promise.resolve();
    },

    remove(symbol: string): Promise<void> {
      write(read().filter((holding) => holding.symbol !== symbol));
      return Promise.resolve();
    },
  };
}

export { STORAGE_KEY };
