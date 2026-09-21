import { type Clock, systemClock } from '@tickr/core-common';
import { type SocketFactory, openReconnectingFeed, type ReconnectingFeed } from '@tickr/core-network';
import {
  type FeedStatus,
  type PriceRepository,
  type PriceTick,
} from '@tickr/portfolio-domain';

import { TickerSchema } from '../remote/tickerDto';
import { productIdForSymbol, toPriceTick } from '../remote/tickerMapper';

const FEED_URL = 'wss://ws-feed.exchange.coinbase.com';
const TICKER_TYPE = 'ticker';

export interface CoinbasePriceRepositoryDeps {
  socketFactory: SocketFactory;
  clock?: Clock;
  logger?: { warn: (message: string, error?: unknown) => void };
}

/**
 * Live prices from Coinbase's public market data feed.
 *
 * No API key and no account: the feed is open, which is what lets the web build
 * subscribe straight from the browser. Web sockets are exempt from CORS
 * preflight, so there is no proxy in between on any platform.
 *
 * The cache is a field on the repository rather than a local of the stream,
 * and that is the single most important detail in this file. Adding or removing
 * a holding changes the symbol set, which tears the stream down and starts a
 * new one. A per-stream accumulator started empty every time, so adding one
 * asset dropped every other row back to unpriced until it ticked again. The
 * Kotlin version has the same comment in the same place, because it was the
 * same bug.
 */
export function createCoinbasePriceRepository(
  deps: CoinbasePriceRepositoryDeps,
): PriceRepository {
  const { socketFactory, clock = systemClock, logger = console } = deps;

  const cache = new Map<string, PriceTick>();
  let status: FeedStatus = 'connecting';
  const statusListeners = new Set<(status: FeedStatus) => void>();

  const setStatus = (next: FeedStatus) => {
    if (status === next) return;
    status = next;
    for (const listener of statusListeners) listener(next);
  };

  return {
    observeStatus(): AsyncIterable<FeedStatus> {
      return {
        [Symbol.asyncIterator]() {
          // A queue rather than a callback, so a slow consumer applies
          // backpressure instead of dropping status changes. Status changes are
          // rare, so the queue never grows.
          const pending: FeedStatus[] = [];
          let wake: (() => void) | null = null;
          let done = false;

          const push = (value: FeedStatus) => {
            pending.push(value);
            wake?.();
          };

          statusListeners.add(push);
          push(status);

          return {
            async next(): Promise<IteratorResult<FeedStatus>> {
              while (pending.length === 0 && !done) {
                await new Promise<void>((resolve) => {
                  wake = resolve;
                });
                wake = null;
              }
              const value = pending.shift();
              if (value === undefined) return { done: true, value: undefined };
              return { done: false, value };
            },
            return(): Promise<IteratorResult<FeedStatus>> {
              done = true;
              statusListeners.delete(push);
              wake?.();
              return Promise.resolve({ done: true, value: undefined });
            },
          };
        },
      };
    },

    observePrices(symbols: ReadonlySet<string>): AsyncIterable<ReadonlyMap<string, PriceTick>> {
      return {
        [Symbol.asyncIterator]() {
          const pending: ReadonlyMap<string, PriceTick>[] = [];
          let wake: (() => void) | null = null;
          let closed = false;
          let feed: ReconnectingFeed | null = null;

          const emit = (value: ReadonlyMap<string, PriceTick>) => {
            pending.push(value);
            wake?.();
          };

          const snapshot = (): ReadonlyMap<string, PriceTick> => {
            const filtered = new Map<string, PriceTick>();
            for (const [symbol, tick] of cache) {
              if (symbols.has(symbol)) filtered.set(symbol, tick);
            }
            return filtered;
          };

          // Emitted before the socket is even attempted. This stream is
          // combined with the holdings stream, and a combine produces nothing
          // until both sides have emitted once, so waiting for the first frame
          // left the whole screen on its loading skeleton for ever when the
          // feed was unreachable. An empty map is the unpriced state the model
          // already represents.
          emit(snapshot());

          if (symbols.size > 0) {
            const byProductId = new Map<string, string>();
            for (const symbol of symbols) byProductId.set(productIdForSymbol(symbol), symbol);

            feed = openReconnectingFeed({
              url: FEED_URL,
              socketFactory,
              clock,
              logger,
              onConnected: () => setStatus('live'),
              onDisconnected: () => setStatus('disconnected'),
              onOpen: (openFeed) => {
                openFeed.send(subscribeMessage([...byProductId.keys()]));
              },
              onMessage: (data) => {
                const parsed = TickerSchema.safeParse(safeJsonParse(data));
                if (!parsed.success) return;
                if (parsed.data.type !== TICKER_TYPE) return;

                const symbol = byProductId.get(parsed.data.product_id);
                if (symbol === undefined) return;

                const tick = toPriceTick(parsed.data);
                if (tick === undefined) return;

                cache.set(symbol, tick);
                emit(snapshot());
              },
            });
          }

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
            return(): Promise<IteratorResult<ReadonlyMap<string, PriceTick>>> {
              closed = true;
              feed?.close();
              feed = null;
              wake?.();
              return Promise.resolve({ done: true, value: undefined });
            },
          };
        },
      };
    },
  };
}

function subscribeMessage(productIds: readonly string[]): string {
  const ids = productIds.map((id) => `"${id}"`).join(',');
  return `{"type":"subscribe","product_ids":[${ids}],"channels":["ticker"]}`;
}

/**
 * A frame that is not JSON is a frame the exchange should not have sent. It is
 * dropped rather than thrown, because throwing inside the socket handler would
 * take down the reconnect loop and the feed would never come back.
 */
function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
