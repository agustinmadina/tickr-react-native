import { type PriceTick } from '@tickr/portfolio-domain';

import { type TickerDto } from './tickerDto';

/**
 * The feed quotes against USD and holdings are stored as the bare asset symbol,
 * so the product id has to be turned back into a symbol.
 *
 * The Kotlin version does the same thing in the opposite direction when it
 * builds the subscribe frame. Both directions live here so they cannot drift.
 */
export function symbolForProductId(productId: string): string {
  const dash = productId.indexOf('-');
  return dash === -1 ? productId : productId.slice(0, dash);
}

export function productIdForSymbol(symbol: string): string {
  return `${symbol.toUpperCase()}-USD`;
}

export function toPriceTick(dto: TickerDto): PriceTick | undefined {
  // A non-finite price is a frame the exchange should not have sent, and it
  // would poison every total downstream. Dropped here, at the boundary.
  if (!Number.isFinite(dto.price) || dto.price <= 0) return undefined;

  return {
    symbol: symbolForProductId(dto.product_id),
    price: dto.price,
    timestampMs: dto.time ? Date.parse(dto.time) : Date.now(),
  };
}
