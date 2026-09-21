import { describe, expect, it } from 'vitest';

import { type Holding, type PriceTick } from './model';
import { computePortfolio } from './portfolio';

const holding = (symbol: string, quantity: number, costBasis: number): Holding => ({
  symbol,
  quantity,
  costBasis,
});

const tick = (symbol: string, price: number): PriceTick => ({
  symbol,
  price,
  timestampMs: 0,
});

/**
 * The portfolio maths, ported from PortfolioSpec.kt.
 *
 * The interesting cases are the unpriced ones. A holding with no quote yet must
 * not be counted as zero, because a zero drags the total down and makes the
 * portfolio look like it lost money while the feed is still connecting. The
 * Kotlin version flags this with `isPartiallyPriced` and the tests below pin the
 * same behaviour.
 */
describe('computePortfolio', () => {
  it('sums value and profit across priced holdings', () => {
    const result = computePortfolio({
      holdings: [holding('BTC', 1, 30_000), holding('ETH', 10, 2_000)],
      prices: new Map([
        ['BTC', tick('BTC', 40_000)],
        ['ETH', tick('ETH', 2_500)],
      ]),
    });

    expect(result.totalValue).toBe(40_000 + 25_000);
    expect(result.totalProfit).toBe(10_000 + 5_000);
    expect(result.isPartiallyPriced).toBe(false);
  });

  it('excludes unpriced holdings from the total rather than counting them as zero', () => {
    const result = computePortfolio({
      holdings: [holding('BTC', 1, 30_000), holding('ETH', 10, 20_000)],
      prices: new Map([['BTC', tick('BTC', 40_000)]]),
    });

    expect(result.totalValue).toBe(40_000);
    expect(result.isPartiallyPriced).toBe(true);
  });

  it('reports a partial portfolio when nothing is priced', () => {
    const result = computePortfolio({
      holdings: [holding('BTC', 1, 30_000)],
      prices: new Map(),
    });

    expect(result.totalValue).toBe(0);
    expect(result.isPartiallyPriced).toBe(true);
  });

  it('is not partially priced when there are no holdings at all', () => {
    const result = computePortfolio({ holdings: [], prices: new Map() });

    expect(result.totalValue).toBe(0);
    expect(result.isPartiallyPriced).toBe(false);
  });

  it('computes return as a percentage of cost basis', () => {
    const result = computePortfolio({
      holdings: [holding('BTC', 1, 100)],
      prices: new Map([['BTC', tick('BTC', 150)]]),
    });

    expect(result.totalReturnPercent).toBeCloseTo(50, 6);
  });

  it('does not divide by zero when the cost basis is zero', () => {
    const result = computePortfolio({
      holdings: [holding('BTC', 1, 0)],
      prices: new Map([['BTC', tick('BTC', 150)]]),
    });

    expect(Number.isFinite(result.totalReturnPercent)).toBe(true);
  });

  it('ignores a price for a symbol that is not held', () => {
    const result = computePortfolio({
      holdings: [holding('BTC', 1, 100)],
      prices: new Map([
        ['BTC', tick('BTC', 150)],
        ['DOGE', tick('DOGE', 1)],
      ]),
    });

    expect(result.totalValue).toBe(150);
  });
});
