import { type HttpClient } from '@tickr/core-network';
import { type Asset, type AssetCatalogRepository } from '@tickr/portfolio-domain';
import { z } from 'zod';

const PRODUCTS_URL = 'https://api.exchange.coinbase.com/products';

const ProductSchema = z.object({
  id: z.string(),
  base_currency: z.string(),
  quote_currency: z.string(),
  display_name: z.string().optional(),
  status: z.string().optional(),
});

const ProductsSchema = z.array(ProductSchema);

export interface CoinbaseAssetCatalogRepositoryDeps {
  httpClient: HttpClient;
}

/**
 * The tradable asset list, fetched once and filtered in memory.
 *
 * The Kotlin version does the same: the catalog is a few hundred rows and
 * changes rarely, so a request per keystroke would be wasteful and would make
 * the search feel slower than it is. The fetch is memoised, and the search is
 * a filter over the cached list.
 */
export function createCoinbaseAssetCatalogRepository(
  deps: CoinbaseAssetCatalogRepositoryDeps,
): AssetCatalogRepository {
  const { httpClient } = deps;
  let cached: readonly Asset[] | null = null;
  let inFlight: Promise<readonly Asset[]> | null = null;

  const load = async (): Promise<readonly Asset[]> => {
    if (cached !== null) return cached;
    // A second caller while the first request is in flight joins it rather than
    // starting another. Without this, opening the search sheet twice in quick
    // succession fetched the whole catalog twice.
    if (inFlight !== null) return inFlight;

    inFlight = httpClient
      .getJson(PRODUCTS_URL, ProductsSchema)
      .then((products) => {
        const assets = products
          // Only USD pairs, and only ones that are actually trading. A delisted
          // product still appears in the catalog and would be searchable, then
          // fail to produce a price for ever.
          .filter((product) => product.quote_currency === 'USD')
          .filter((product) => product.status === undefined || product.status === 'online')
          .map(
            (product): Asset => ({
              symbol: product.base_currency,
              name: product.display_name ?? product.base_currency,
              quoteCurrency: product.quote_currency,
            }),
          );

        // Deduplicated by symbol: several products can share a base currency,
        // and two identical rows in the search results is a bug the user sees.
        const bySymbol = new Map<string, Asset>();
        for (const asset of assets) bySymbol.set(asset.symbol, asset);

        cached = [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
        return cached;
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };

  return {
    async search(query: string): Promise<readonly Asset[]> {
      const assets = await load();
      const needle = query.trim().toUpperCase();
      if (needle === '') return assets.slice(0, 50);

      return assets
        .filter(
          (asset) => asset.symbol.includes(needle) || asset.name.toUpperCase().includes(needle),
        )
        .slice(0, 50);
    },
  };
}
