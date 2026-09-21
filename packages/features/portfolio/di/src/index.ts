import { createHttpClient, createSocket, type HttpClient } from '@tickr/core-network';
import { createJsonStore, type KeyValueStore } from '@tickr/core-storage';
import {
  createCoinbaseAssetCatalogRepository,
  createCoinbasePriceHistoryRepository,
  createCoinbasePriceRepository,
  createStoredHoldingsRepository,
} from '@tickr/portfolio-data';
import { HoldingsDocumentSchema } from '@tickr/portfolio-data';
import { createPortfolioStore, type PortfolioStore } from '@tickr/portfolio-ui';


/**
 * The composition root, and the replacement for Koin.
 *
 * The Kotlin project declares `appModules = listOf(coreModule, portfolioModule)`
 * and Koin resolves the graph at runtime by type. There is no equivalent here
 * and it is worth being explicit about why: TypeScript resolves the graph at
 * compile time, and the wiring below is the graph. A missing dependency is a
 * type error, not a runtime crash on first navigation, which is strictly better
 * than what Koin gives you.
 *
 * What Koin does buy that this does not is swapping an implementation for a
 * test. That is handled by the parameter: `createAppStore` takes the storage
 * and the HTTP client, so a test passes a memory store and a stub client and
 * gets a fully wired store with no mocking framework involved.
 *
 * The one thing this file must not do is leak into the UI. The screens take a
 * `PortfolioStore` and nothing else, so they cannot reach a repository even by
 * accident, which is the same guarantee the Gradle module graph gives the
 * Kotlin project.
 */
export interface AppDependencies {
  /** The platform key-value store: MMKV on native, localStorage on web. */
  readonly keyValueStore: KeyValueStore;
  /** Overridable so a test can inject a stub transport. */
  readonly httpClient?: HttpClient;
}

export function createAppStore(dependencies: AppDependencies): PortfolioStore {
  const httpClient = dependencies.httpClient ?? createHttpClient();

  // One socket factory for the whole app. The price repository owns the
  // connection; nothing else opens one, which is what keeps the reconnect
  // backoff meaningful rather than three sockets racing to reconnect.
  //
  // `createSocket` is the factory object itself, not a function that returns
  // one: it is the seam that lets a test swap in a fake transport, so it is
  // already the thing the repository wants. Calling it would be a type error
  // if the types were not erased at the module boundary.
  const socketFactory = createSocket;

  const holdingsStore = createJsonStore(
    dependencies.keyValueStore,
    'tickr.holdings.v1',
    HoldingsDocumentSchema,
  );

  return createPortfolioStore({
    priceRepository: createCoinbasePriceRepository({ socketFactory }),
    priceHistoryRepository: createCoinbasePriceHistoryRepository({ httpClient }),
    holdingsRepository: createStoredHoldingsRepository(holdingsStore),
    assetCatalogRepository: createCoinbaseAssetCatalogRepository({ httpClient }),
  });
}

export { type PortfolioStore } from '@tickr/portfolio-ui';
