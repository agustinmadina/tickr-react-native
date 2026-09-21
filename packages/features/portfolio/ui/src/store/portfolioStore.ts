import {
  type AssetCatalogRepository,
  type Holding,
  type HoldingsRepository,
  type HistoryRange,
  type PriceHistoryRepository,
  type PriceRepository,
  type PriceTick,
  computePortfolio,
} from '@tickr/portfolio-domain';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { toHoldingUi } from '../mapper/portfolioUiMapper';
import { type PortfolioUiState } from '../model';

export interface PortfolioStoreDeps {
  priceRepository: PriceRepository;
  priceHistoryRepository: PriceHistoryRepository;
  holdingsRepository: HoldingsRepository;
  assetCatalogRepository: AssetCatalogRepository;
}

/**
 * Declared as properties, not as methods, and the difference is load-bearing.
 *
 * A method shorthand (`start(): () => void`) types `this` as the store, so
 * `const start = store.start` looks like a method torn off its receiver, and
 * `@typescript-eslint/unbound-method` reports every one of the eight actions at
 * every call site. The methods here close over the store rather than reading it
 * through `this`, so that warning is describing a hazard that cannot happen.
 *
 * Writing them as arrow-typed properties says so in the type system: `this` is
 * `void`, destructuring an action is safe, and the rule has nothing to report.
 * Passing `store.setRange` straight into a child is the normal Zustand
 * pattern, and this is the type that makes it legal to write.
 */
export type PortfolioStore = StoreApi<PortfolioUiState> & {
  /** Starts the streams. Returns a teardown that stops them. */
  start: () => () => void;
  setRange: (range: HistoryRange) => void;
  setOverviewScrubIndex: (index: number | null) => void;
  setDetailScrubIndex: (index: number | null) => void;
  selectSymbol: (symbol: string | null) => void;
  addHolding: (symbol: string, quantity: number, costBasis: number) => Promise<void>;
  removeHolding: (symbol: string) => Promise<void>;
  searchAssets: (query: string) => Promise<readonly { symbol: string; name: string }[]>;
};

const initialState: PortfolioUiState = {
  holdings: [],
  totalValue: 0,
  totalProfit: 0,
  totalReturnPercent: 0,
  dayChangePercent: 0,
  totalHistory: [],
  feedStatus: 'connecting',
  displayedRange: 'day',
  isLoading: true,
  isPartiallyPriced: false,
  errorMessage: null,
  overviewScrubIndex: null,
  detailScrubIndex: null,
  selectedSymbol: null,
};

/**
 * The ViewModel, as a store.
 *
 * The Kotlin `PortfolioViewModel` holds a `MutableStateFlow<PortfolioUiState>`
 * and updates it with `updateState { it.copy(...) }`. Zustand's `set` is the
 * same operation, and the reducers below are near-literal translations.
 *
 * What is genuinely different is the subscription model, and it is the thing
 * that decides whether this app is fast or not.
 *
 * In Kotlin, the ViewModel collects three flows with `launchIn(viewModelScope)`
 * and the Compose screen reads one state object. Compose's recomposition is
 * fine-grained: only the composables that read a changed field re-run.
 *
 * In React, a component that reads the whole state object re-renders whenever
 * *any* field changes. Prices arrive several times a second, so a screen that
 * subscribes to the whole store re-renders several times a second, and so does
 * every child. That is the single biggest performance trap in this port, and
 * `usePortfolio` is the answer to it.
 *
 * The store is built with `zustand/vanilla` rather than `zustand` so it has no
 * React dependency at all: it can be driven from a test with no renderer, and
 * the hook is the only file that knows React exists.
 */
export function createPortfolioStore(deps: PortfolioStoreDeps): PortfolioStore {
  const store = createStore<PortfolioUiState>(() => initialState);

  let teardown: (() => void) | null = null;
  let historyAbort: AbortController | null = null;
  let rawHoldings: readonly Holding[] = [];
  let latestPrices: ReadonlyMap<string, PriceTick> = new Map();

  /**
   * Rebuilds the UI rows from the two inputs that feed them.
   *
   * Called from both streams, because either can arrive first and the rows need
   * both. The Kotlin version does the same thing with `combine`, but a combine
   * emits nothing until both sides have emitted once, and the price stream is
   * deliberately seeded with an empty map to avoid exactly that stall. Here the
   * seeding is unnecessary: the recompute simply runs twice, and the second run
   * has both.
   */
  const recompute = () => {
    const portfolio = computePortfolio({ holdings: rawHoldings, prices: latestPrices });

    store.setState((previous) => ({
      ...previous,
      holdings: rawHoldings.map((holding) =>
        toHoldingUi(
          holding,
          latestPrices.get(holding.symbol),
          previous.holdings.find((ui) => ui.symbol === holding.symbol)?.history ?? [],
        ),
      ),
      totalValue: portfolio.totalValue,
      totalProfit: portfolio.totalProfit,
      totalReturnPercent: portfolio.totalReturnPercent,
      isPartiallyPriced: portfolio.isPartiallyPriced,
      isLoading: false,
    }));
  };

  const refreshHistory = async (range: HistoryRange) => {
    // Cancelled rather than left to race. Picking a range while the last one is
    // still loading must not let the slower response overwrite the newer one.
    historyAbort?.abort();
    const controller = new AbortController();
    historyAbort = controller;

    try {
      const history = await deps.priceHistoryRepository.fetchHistory(rawHoldings, range);
      if (controller.signal.aborted) return;

      store.setState((previous) => {
        const bySymbol = new Map<string, readonly number[]>();
        for (const [symbol, points] of history) {
          bySymbol.set(
            symbol,
            points.map((point) => point.price),
          );
        }

        return {
          ...previous,
          displayedRange: range,
          holdings: previous.holdings.map((holding) => ({
            ...holding,
            history: bySymbol.get(holding.symbol) ?? holding.history,
          })),
          // A new range is a new series, so an index into the old one means
          // nothing and would point at a sample that no longer exists.
          overviewScrubIndex: null,
          detailScrubIndex: null,
        };
      });
    } catch {
      // A failed history fetch leaves the chart with whatever it had. It is not
      // worth an error banner: the prices are still live and the screen is
      // still useful.
    }
  };

  /**
   * Subscribes to a price stream for a given symbol set.
   *
   * The symbol set is the reason this is a function rather than a one-off
   * subscription. The Kotlin repository takes the symbols as a parameter and
   * the caller's `flatMapLatest` tears the socket down and rebuilds it when the
   * holdings change. Here the same thing happens: when the holdings change, the
   * old subscription is cancelled and a new one is opened with the new symbols.
   *
   * Passing an empty set, which is what a naive first version does, subscribes
   * to nothing and the feed never delivers a single price.
   */
  let priceSubscription: AbortController | null = null;

  const subscribeToPrices = (symbols: ReadonlySet<string>) => {
    priceSubscription?.abort();
    const controller = new AbortController();
    priceSubscription = controller;

    void (async () => {
      const iterator = deps.priceRepository.observePrices(symbols)[Symbol.asyncIterator]();
      try {
        while (!controller.signal.aborted) {
          const result = await iterator.next();
          if (result.done === true) break;
          latestPrices = result.value;
          recompute();
        }
      } catch {
        // A stream that throws is a stream that ended. The UI keeps the last
        // known prices, which is the posture the Kotlin repository takes toward
        // a dropped feed.
      } finally {
        await iterator.return?.();
      }
    })();
  };

  const storeWithActions: PortfolioStore = Object.assign(store, {
    start(): () => void {
      if (teardown !== null) return teardown;

      const controllers: AbortController[] = [];

      const run = <T>(iterable: AsyncIterable<T>, onValue: (value: T) => void) => {
        const controller = new AbortController();
        controllers.push(controller);

        void (async () => {
          const iterator = iterable[Symbol.asyncIterator]();
          try {
            while (!controller.signal.aborted) {
              const result = await iterator.next();
              if (result.done === true) break;
              // The abort is checked again after the await, not only before it.
              // A `next()` that was already in flight when `stop()` ran still
              // resolves, and without this second check the value is delivered
              // to a store that has been torn down, which restarts the price
              // subscription and leaves a socket open behind a dead screen.
              if (controller.signal.aborted) break;
              onValue(result.value);
            }
          } catch {
            // Same posture as above: a stream that ended is not an error the
            // user needs to see.
          } finally {
            await iterator.return?.();
          }
        })();
      };

      run(deps.holdingsRepository.observeHoldings(), (holdings) => {
        rawHoldings = holdings;
        // The symbol set changed, so the socket has to be rebuilt around it.
        // Without this, adding a holding would show a row that never prices.
        subscribeToPrices(new Set(holdings.map((holding) => holding.symbol)));
        recompute();
        void refreshHistory(store.getState().displayedRange);
      });

      run(deps.priceRepository.observeStatus(), (status) => {
        store.setState((previous) => ({ ...previous, feedStatus: status }));
      });

      teardown = () => {
        for (const controller of controllers) controller.abort();
        priceSubscription?.abort();
        historyAbort?.abort();
        teardown = null;
      };
      return teardown;
    },

    setRange(range: HistoryRange): void {
      store.setState((previous) => ({ ...previous, displayedRange: range }));
      void refreshHistory(range);
    },

    setOverviewScrubIndex(index: number | null): void {
      store.setState((previous) => ({ ...previous, overviewScrubIndex: index }));
    },

    setDetailScrubIndex(index: number | null): void {
      store.setState((previous) => ({ ...previous, detailScrubIndex: index }));
    },

    selectSymbol(symbol: string | null): void {
      store.setState((previous) => ({ ...previous, selectedSymbol: symbol }));
    },

    async addHolding(symbol: string, quantity: number, costBasis: number): Promise<void> {
      await deps.holdingsRepository.add({ symbol: symbol.toUpperCase(), quantity, costBasis });
    },

    async removeHolding(symbol: string): Promise<void> {
      await deps.holdingsRepository.remove(symbol);
      store.setState((previous) => ({
        ...previous,
        selectedSymbol: previous.selectedSymbol === symbol ? null : previous.selectedSymbol,
      }));
    },

    async searchAssets(query: string) {
      const assets = await deps.assetCatalogRepository.search(query);
      return assets.map((asset) => ({ symbol: asset.symbol, name: asset.name }));
    },
  });

  return storeWithActions;
}
