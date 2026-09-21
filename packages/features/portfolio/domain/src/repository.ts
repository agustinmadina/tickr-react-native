import { type Asset, type FeedStatus, type Holding, type HistoryRange, type PricePoint, type PriceTick } from './model';

/**
 * The repository interfaces, mirroring the Kotlin ones.
 *
 * The Kotlin versions return `Flow<T>`; these return `AsyncIterable<T>`, which
 * is the language-level equivalent and needs no library. The data layer
 * implements them, the UI layer consumes them, and neither knows about the
 * other. This is the seam the whole architecture hangs on.
 */

export interface PriceRepository {
  /** Live prices for the given symbols, re-emitted as they change. */
  observePrices(symbols: ReadonlySet<string>): AsyncIterable<ReadonlyMap<string, PriceTick>>;
  observeStatus(): AsyncIterable<FeedStatus>;
}

export interface PriceHistoryRepository {
  fetchHistory(
    holdings: readonly Holding[],
    range: HistoryRange,
  ): Promise<ReadonlyMap<string, readonly PricePoint[]>>;
}

export interface HoldingsRepository {
  /** The stored holdings, re-emitted whenever they change. */
  observeHoldings(): AsyncIterable<readonly Holding[]>;
  add(holding: Holding): Promise<void>;
  remove(symbol: string): Promise<void>;
}

export interface AssetCatalogRepository {
  search(query: string): Promise<readonly Asset[]>;
}
