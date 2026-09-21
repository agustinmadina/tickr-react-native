import { useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand';

import { type PortfolioUiState } from '../model';

import { type PortfolioStore } from './portfolioStore';

/**
 * Reads from the portfolio store, with a selector.
 *
 * The selector is not optional and it is not a convenience. A component that
 * calls `usePortfolio((state) => state)` re-renders on every price tick, and
 * because the tick arrives several times a second, so does everything below it.
 * A component that calls `usePortfolio((state) => state.holdings[0]?.price)`
 * re-renders only when that one number changes.
 *
 * This is the React equivalent of what Compose does automatically. Compose
 * tracks which state each composable read and recomposes only those. React has
 * no such tracking, so the subscription has to be narrowed by hand, and getting
 * it wrong is invisible until the list is long enough to stutter.
 *
 * `useStore` from Zustand compares the selected value with `Object.is` by
 * default. That is correct for primitives and for stable references, and wrong
 * for a selector that builds a new object each call, which is why the selectors
 * in the screens below return primitives or pick from the existing state.
 */
export function usePortfolio<T>(store: PortfolioStore, selector: (state: PortfolioUiState) => T): T {
  return useStore(store, selector);
}

/**
 * Starts the store's streams for the lifetime of the component that calls it,
 * and stops them when it unmounts.
 *
 * The Kotlin equivalent is `viewModelScope`: the ViewModel starts its
 * collectors in `init` and the framework cancels them when the ViewModel is
 * cleared. React has no such scope, so the lifecycle is explicit, and the
 * cleanup is what stops a screen that was navigated away from from keeping a
 * WebSocket open.
 *
 * The store is held in a ref so a caller passing an inline object does not
 * restart the streams on every render. Restarting them would tear down and
 * rebuild the socket several times a second, which is exactly the reconnect
 * storm the backoff logic exists to prevent.
 */
export function usePortfolioLifecycle(store: PortfolioStore): void {
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    const stop = storeRef.current.start();
    return stop;
  }, []);
}

/**
 * A memoised selector for a single holding's price.
 *
 * Exported because it is the pattern the list rows use, and because getting it
 * wrong is the most common way this port would end up slower than the Kotlin
 * one. The selector returns a primitive, so `Object.is` is the right comparison
 * and the row re-renders only when its own price changes.
 */
export function useHoldingPrice(store: PortfolioStore, symbol: string): number {
  const selector = useMemo(
    () => (state: PortfolioUiState) =>
      state.holdings.find((holding) => holding.symbol === symbol)?.price ?? 0,
    [symbol],
  );
  return usePortfolio(store, selector);
}
