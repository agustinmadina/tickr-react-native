import {
  type Asset,
  type AssetCatalogRepository,
  type FeedStatus,
  type Holding,
  type HoldingsRepository,
  type HistoryRange,
  type PriceHistoryRepository,
  type PricePoint,
  type PriceRepository,
  type PriceTick,
} from '@tickr/portfolio-domain';
import { describe, expect, it } from 'vitest';

import { createPortfolioStore, type PortfolioStoreDeps } from './portfolioStore';

/**
 * A price repository that records the symbol sets it was asked for.
 *
 * The recording is the point. The bug this test exists to catch is a store that
 * subscribes with an empty symbol set, which produces a feed that connects,
 * reports itself live, and never delivers a price. Nothing throws, nothing logs,
 * and the UI just shows zeros, so the only way to catch it is to assert on what
 * was requested.
 */
function createFakePriceRepository() {
  const requestedSymbolSets: ReadonlySet<string>[] = [];
  let emitPrices: ((prices: ReadonlyMap<string, PriceTick>) => void) | null = null;
  let emitStatus: ((status: FeedStatus) => void) | null = null;

  const repository: PriceRepository = {
    observePrices(symbols: ReadonlySet<string>): AsyncIterable<ReadonlyMap<string, PriceTick>> {
      requestedSymbolSets.push(symbols);
      return {
        [Symbol.asyncIterator]() {
          const pending: ReadonlyMap<string, PriceTick>[] = [];
          let wake: (() => void) | null = null;
          let closed = false;

          emitPrices = (prices) => {
            pending.push(prices);
            wake?.();
          };

          return {
            async next(): Promise<IteratorResult<ReadonlyMap<string, PriceTick>>> {
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
            async return(): Promise<IteratorResult<ReadonlyMap<string, PriceTick>>> {
              closed = true;
              wake?.();
              return { done: true, value: undefined };
            },
          };
        },
      };
    },

    observeStatus(): AsyncIterable<FeedStatus> {
      return {
        [Symbol.asyncIterator]() {
          const pending: FeedStatus[] = [];
          let wake: (() => void) | null = null;
          let closed = false;

          emitStatus = (status) => {
            pending.push(status);
            wake?.();
          };

          return {
            async next(): Promise<IteratorResult<FeedStatus>> {
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
            async return(): Promise<IteratorResult<FeedStatus>> {
              closed = true;
              wake?.();
              return { done: true, value: undefined };
            },
          };
        },
      };
    },
  };

  return {
    repository,
    requestedSymbolSets,
    pushPrices: (prices: ReadonlyMap<string, PriceTick>) => emitPrices?.(prices),
    pushStatus: (status: FeedStatus) => emitStatus?.(status),
  };
}

function createFakeHoldingsRepository(initial: readonly Holding[]) {
  let emit: ((holdings: readonly Holding[]) => void) | null = null;
  let current = initial;

  const repository: HoldingsRepository = {
    observeHoldings(): AsyncIterable<readonly Holding[]> {
      return {
        [Symbol.asyncIterator]() {
          const pending: (readonly Holding[])[] = [];
          let wake: (() => void) | null = null;
          let closed = false;

          emit = (holdings) => {
            pending.push(holdings);
            wake?.();
          };
          pending.push(current);

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
            async return(): Promise<IteratorResult<readonly Holding[]>> {
              closed = true;
              wake?.();
              return { done: true, value: undefined };
            },
          };
        },
      };
    },
    async add(holding: Holding): Promise<void> {
      current = [...current.filter((existing) => existing.symbol !== holding.symbol), holding];
      emit?.(current);
    },
    async remove(symbol: string): Promise<void> {
      current = current.filter((holding) => holding.symbol !== symbol);
      emit?.(current);
    },
  };

  return { repository, push: (holdings: readonly Holding[]) => emit?.(holdings) };
}

const noHistory: PriceHistoryRepository = {
  async fetchHistory(): Promise<ReadonlyMap<string, readonly PricePoint[]>> {
    return new Map();
  },
};

const noCatalog: AssetCatalogRepository = {
  async search(): Promise<readonly Asset[]> {
    return [];
  },
};

function createDeps(overrides: Partial<PortfolioStoreDeps> = {}): {
  deps: PortfolioStoreDeps;
  prices: ReturnType<typeof createFakePriceRepository>;
  holdings: ReturnType<typeof createFakeHoldingsRepository>;
} {
  const prices = createFakePriceRepository();
  const holdings = createFakeHoldingsRepository([]);

  return {
    deps: {
      priceRepository: prices.repository,
      priceHistoryRepository: noHistory,
      holdingsRepository: holdings.repository,
      assetCatalogRepository: noCatalog,
      ...overrides,
    },
    prices,
    holdings,
  };
}

/** Lets the store's async iterators drain before the assertion. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('createPortfolioStore', () => {
  it('starts with the loading flag set and no holdings', () => {
    const { deps } = createDeps();
    const store = createPortfolioStore(deps);

    expect(store.getState().isLoading).toBe(true);
    expect(store.getState().holdings).toEqual([]);
  });

  it('subscribes to prices with the held symbols, not an empty set', async () => {
    const { deps, prices, holdings } = createDeps();
    const store = createPortfolioStore(deps);

    const stop = store.start();
    holdings.push([{ symbol: 'BTC', quantity: 1, costBasis: 30_000 }]);
    await settle();

    expect(prices.requestedSymbolSets.length).toBeGreaterThan(0);
    const lastRequest = prices.requestedSymbolSets[prices.requestedSymbolSets.length - 1];
    expect(lastRequest).toEqual(new Set(['BTC']));

    stop();
  });

  it('prices a holding once a tick arrives', async () => {
    const { deps, prices, holdings } = createDeps();
    const store = createPortfolioStore(deps);

    const stop = store.start();
    holdings.push([{ symbol: 'BTC', quantity: 2, costBasis: 30_000 }]);
    await settle();

    prices.pushPrices(new Map([['BTC', { symbol: 'BTC', price: 40_000, timestampMs: 0 }]]));
    await settle();

    expect(store.getState().holdings[0]?.price).toBe(40_000);
    expect(store.getState().totalValue).toBe(80_000);
    expect(store.getState().isLoading).toBe(false);

    stop();
  });

  it('rebuilds the price subscription when the holdings change', async () => {
    const { deps, prices, holdings } = createDeps();
    const store = createPortfolioStore(deps);

    const stop = store.start();
    holdings.push([{ symbol: 'BTC', quantity: 1, costBasis: 30_000 }]);
    await settle();
    holdings.push([
      { symbol: 'BTC', quantity: 1, costBasis: 30_000 },
      { symbol: 'ETH', quantity: 10, costBasis: 2_000 },
    ]);
    await settle();

    const lastRequest = prices.requestedSymbolSets[prices.requestedSymbolSets.length - 1];
    expect(lastRequest).toEqual(new Set(['BTC', 'ETH']));

    stop();
  });

  it('tracks the feed status', async () => {
    const { deps, prices } = createDeps();
    const store = createPortfolioStore(deps);

    const stop = store.start();
    prices.pushStatus('live');
    await settle();

    expect(store.getState().feedStatus).toBe('live');

    stop();
  });

  it('stops the streams on teardown', async () => {
    const { deps, prices, holdings } = createDeps();
    const store = createPortfolioStore(deps);

    const stop = store.start();
    holdings.push([{ symbol: 'BTC', quantity: 1, costBasis: 30_000 }]);
    await settle();
    stop();

    const requestsBefore = prices.requestedSymbolSets.length;
    holdings.push([{ symbol: 'ETH', quantity: 1, costBasis: 1_000 }]);
    await settle();

    expect(prices.requestedSymbolSets.length).toBe(requestsBefore);
  });

  it('clears the selection when the selected holding is removed', async () => {
    const { deps, holdings } = createDeps();
    const store = createPortfolioStore(deps);

    const stop = store.start();
    holdings.push([{ symbol: 'BTC', quantity: 1, costBasis: 30_000 }]);
    await settle();

    store.selectSymbol('BTC');
    expect(store.getState().selectedSymbol).toBe('BTC');

    await store.removeHolding('BTC');
    expect(store.getState().selectedSymbol).toBeNull();

    stop();
  });

  it('resets the scrub index when the range changes', async () => {
    const { deps } = createDeps();
    const store = createPortfolioStore(deps);

    const stop = store.start();
    store.setOverviewScrubIndex(3);
    expect(store.getState().overviewScrubIndex).toBe(3);

    store.setRange('week' as HistoryRange);
    await settle();

    expect(store.getState().overviewScrubIndex).toBeNull();

    stop();
  });
});
