import { createAppStore } from '@tickr/portfolio-di';
import { type PortfolioStore } from '@tickr/portfolio-ui';
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

import { createPlatformKeyValueStore } from '../storage/keyValueStore';

const StoreContext = createContext<PortfolioStore | null>(null);

/**
 * The store, provided once and read by every screen.
 *
 * This is the closest thing to Koin's `single { }` in the port. The store is
 * built once, held in a ref so a re-render cannot rebuild it, and the streams
 * are started here rather than in a screen, because the socket must outlive
 * navigation between the overview and a detail screen.
 *
 * The teardown runs on unmount, which in practice is app teardown. That matters
 * on web, where the page can be navigated away from without the process ending,
 * and a WebSocket left open would keep the tab's connection alive.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<PortfolioStore | null>(null);

  if (storeRef.current === null) {
    storeRef.current = createAppStore({
      keyValueStore: createPlatformKeyValueStore('tickr'),
    });
  }

  const store = storeRef.current;

  useEffect(() => {
    const stop = store.start();
    return stop;
  }, [store]);

  const value = useMemo(() => store, [store]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): PortfolioStore {
  const store = useContext(StoreContext);
  if (store === null) {
    throw new Error('useStore must be called inside a StoreProvider');
  }
  return store;
}
