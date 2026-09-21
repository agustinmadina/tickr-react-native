/**
 * The domain models, mirroring the Kotlin ones one for one.
 *
 * These are plain types, not classes. The Kotlin versions are data classes with
 * `copy`, which TypeScript gets from object spread. The one thing that does not
 * carry over is `@Serializable`: serialisation is a data-layer concern here, so
 * the DTOs live in the data package and these stay free of any library.
 */

export interface Asset {
  readonly symbol: string;
  readonly name: string;
  readonly quoteCurrency: string;
}

export interface Holding {
  readonly symbol: string;
  readonly quantity: number;
  /** Price paid per unit, in the quote currency. */
  readonly costBasis: number;
}

export interface PriceTick {
  readonly symbol: string;
  readonly price: number;
  readonly timestampMs: number;
}

export interface PricePoint {
  readonly timestampMs: number;
  readonly price: number;
}

export type FeedStatus = 'connecting' | 'live' | 'disconnected';

export interface Portfolio {
  readonly holdings: readonly Holding[];
  readonly prices: ReadonlyMap<string, PriceTick>;
  readonly totalValue: number;
  readonly totalCost: number;
  readonly totalProfit: number;
  readonly totalReturnPercent: number;
  readonly dayChange: number;
  readonly dayChangePercent: number;
  /**
   * True while at least one holding has no price yet.
   *
   * Quotes arrive one asset at a time, so a total computed from a partial set
   * is not a smaller number, it is a wrong one. The UI uses this to hold back
   * the live total rather than showing it climb as quotes trickle in.
   */
  readonly isPartiallyPriced: boolean;
}

export interface PortfolioHistory {
  readonly range: HistoryRange;
  readonly total: readonly number[];
  readonly perSymbol: ReadonlyMap<string, readonly number[]>;
}

export const HISTORY_RANGES = ['hour', 'day', 'week', 'month', 'year'] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

export function historyRangeLabel(range: HistoryRange): string {
  switch (range) {
    case 'hour':
      return '1H';
    case 'day':
      return '1D';
    case 'week':
      return '1W';
    case 'month':
      return '1M';
    case 'year':
      return '1Y';
  }
}

export function historyRangeDurationMs(range: HistoryRange): number {
  const hour = 60 * 60 * 1000;
  switch (range) {
    case 'hour':
      return hour;
    case 'day':
      return 24 * hour;
    case 'week':
      return 7 * 24 * hour;
    case 'month':
      return 30 * 24 * hour;
    case 'year':
      return 365 * 24 * hour;
  }
}
