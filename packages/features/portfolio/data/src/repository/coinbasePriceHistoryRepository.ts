import { type HttpClient } from '@tickr/core-network';
import {
  type HistoryRange,
  type Holding,
  type PriceHistoryRepository,
  type PricePoint,
  historyRangeDurationMs,
} from '@tickr/portfolio-domain';
import { z } from 'zod';

const CANDLES_URL = 'https://api.exchange.coinbase.com/products';

/**
 * Coinbase's candle endpoint returns a bare array of arrays, not objects:
 *
 *   [[ time, low, high, open, close, volume ], ...]
 *
 * The Kotlin version has a `CatalogJson`-style DTO for this. Zod handles it
 * with a tuple, which is the honest representation: the shape is positional and
 * naming the fields would be a lie about what the API sends.
 */
const CandleSchema = z.tuple([
  z.coerce.number(), // time, seconds
  z.coerce.number(), // low
  z.coerce.number(), // high
  z.coerce.number(), // open
  z.coerce.number(), // close
  z.coerce.number(), // volume
]);

const CandlesSchema = z.array(CandleSchema);

/** Coinbase caps this endpoint at 300 candles per request. */
const MAX_CANDLES = 300;

export interface CoinbasePriceHistoryRepositoryDeps {
  httpClient: HttpClient;
}

export function createCoinbasePriceHistoryRepository(
  deps: CoinbasePriceHistoryRepositoryDeps,
): PriceHistoryRepository {
  const { httpClient } = deps;

  return {
    async fetchHistory(
      holdings: readonly Holding[],
      range: HistoryRange,
    ): Promise<ReadonlyMap<string, readonly PricePoint[]>> {
      const granularity = granularityFor(range);
      const end = Math.floor(Date.now() / 1000);
      const start = end - Math.floor(historyRangeDurationMs(range) / 1000);

      const results = await Promise.all(
        holdings.map(async (holding) => {
          const url =
            `${CANDLES_URL}/${holding.symbol.toUpperCase()}-USD/candles` +
            `?granularity=${granularity}&start=${start}&end=${end}`;

          try {
            const candles = await httpClient.getJson(url, CandlesSchema);
            // Newest first from the API, oldest first for the chart. Reversed
            // here rather than in the UI, so every consumer agrees on the order.
            const points = candles
              .slice(0, MAX_CANDLES)
              .map((candle): PricePoint => ({ timestampMs: candle[0] * 1000, price: candle[4] }))
              .reverse();
            return [holding.symbol, points] as const;
          } catch {
            // One symbol failing must not blank the whole chart. The Kotlin
            // version does the same: the series is simply absent and the chart
            // draws what it has.
            return [holding.symbol, [] as readonly PricePoint[]] as const;
          }
        }),
      );

      return new Map(results);
    },
  };
}

/**
 * Coinbase accepts a fixed set of granularities, in seconds. Anything else is
 * rejected with a 400, so the mapping is explicit rather than computed.
 */
function granularityFor(range: HistoryRange): number {
  switch (range) {
    case 'hour':
      return 60;
    case 'day':
      return 300;
    case 'week':
      return 3600;
    case 'month':
      return 21600;
    case 'year':
      return 86400;
  }
}
