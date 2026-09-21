import { backoffMillis, type Clock, systemClock } from '@tickr/core-common';

import { type SocketFactory } from './socket';

/**
 * A WebSocket that reconnects, with the failure semantics the Kotlin project
 * settled on after getting them wrong once.
 *
 * The Kotlin comments in CoinbasePriceRepository.kt record three bugs that were
 * fixed there, and all three are reproduced here deliberately, because they are
 * properties of the problem rather than of Kotlin:
 *
 * 1. The failure counter resets on the first *message*, not on connect. A
 *    socket that is accepted and then dropped reset the count on every attempt,
 *    which turned the capped backoff into a reconnect every second for as long
 *    as the app was open.
 *
 * 2. A clean close is still a feed that has stopped delivering, so it counts as
 *    a disconnect and schedules a reconnect.
 *
 * 3. A dropped feed is expected on mobile. It is logged and retried, never
 *    surfaced as an error, and the last known values stay on screen meanwhile.
 */

export interface ReconnectingFeed {
  /** Sends a frame if the socket is open. Silently dropped otherwise. */
  send(data: string): void;
  /** Stops the loop. Idempotent. */
  close(): void;
}

export interface ReconnectingFeedOptions {
  url: string;
  socketFactory: SocketFactory;
  /** Called once the socket is open, to send the subscribe frame. */
  onOpen: (feed: ReconnectingFeed) => void;
  onMessage: (data: string) => void;
  onDisconnected: (error?: unknown) => void;
  onConnected: () => void;
  clock?: Clock;
  logger?: { warn: (message: string, error?: unknown) => void };
}

export function openReconnectingFeed(options: ReconnectingFeedOptions): ReconnectingFeed {
  const {
    url,
    socketFactory,
    onOpen,
    onMessage,
    onDisconnected,
    onConnected,
    clock = systemClock,
    logger = console,
  } = options;

  let failures = 0;
  let closed = false;
  let handle: { send: (data: string) => void; close: () => void } | null = null;
  let timer: unknown = null;

  const feed: ReconnectingFeed = {
    send: (data) => handle?.send(data),
    close: () => {
      if (closed) return;
      closed = true;
      if (timer !== null) {
        clock.clearTimeout(timer);
        timer = null;
      }
      handle?.close();
      handle = null;
    },
  };

  const connect = () => {
    if (closed) return;

    handle = socketFactory.open(url, {
      onOpen: () => {
        onConnected();
        onOpen(feed);
      },

      onMessage: (data) => {
        // Reset here, not on connect. See note 1 above.
        failures = 0;
        onMessage(data);
      },

      onClose: () => {
        handle = null;
        if (closed) return;
        // A clean close is still a dead feed. See note 2 above.
        onDisconnected();
        scheduleReconnect();
      },

      onError: (error) => {
        // onerror is always followed by onclose in the WebSocket spec, so the
        // reconnect is scheduled there and not here. Scheduling in both places
        // would double the reconnect rate.
        logger.warn('Price feed error', error);
      },
    });
  };

  const scheduleReconnect = () => {
    if (closed) return;
    const delay = backoffMillis(failures);
    failures += 1;
    timer = clock.setTimeout(() => {
      timer = null;
      connect();
    }, delay);
  };

  connect();
  return feed;
}
