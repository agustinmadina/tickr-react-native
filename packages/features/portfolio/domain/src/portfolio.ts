import { type Holding, type Portfolio, type PriceTick } from './model';

export interface PortfolioInput {
  readonly holdings: readonly Holding[];
  readonly prices: ReadonlyMap<string, PriceTick>;
}

/**
 * Derives the aggregate portfolio from holdings and the latest prices.
 *
 * Pure, and deliberately so: this is the function the Kotlin project tests in
 * PortfolioSpec.kt, and it is the one piece of the domain that has real logic
 * in it. Everything else is a data class.
 *
 * The `isPartiallyPriced` flag is the subtle part. A holding with no quote yet
 * contributes zero to the total, which makes the total wrong rather than
 * merely incomplete, and the UI has to know that so it can hold back the live
 * figure instead of showing it climb as quotes trickle in.
 */
export function computePortfolio(input: PortfolioInput): Portfolio {
  const { holdings, prices } = input;

  let totalValue = 0;
  let totalCost = 0;
  let isPartiallyPriced = false;

  for (const holding of holdings) {
    const tick = prices.get(holding.symbol);
    totalCost += holding.quantity * holding.costBasis;

    if (tick === undefined) {
      isPartiallyPriced = true;
      continue;
    }
    totalValue += holding.quantity * tick.price;
  }

  const totalProfit = totalValue - totalCost;
  const totalReturnPercent = totalCost === 0 ? 0 : (totalProfit / totalCost) * 100;

  return {
    holdings,
    prices,
    totalValue,
    totalCost,
    totalProfit,
    totalReturnPercent,
    // The day change needs a previous close per symbol, which the live feed
    // does not carry. It is filled in by the history stream, so it starts at
    // zero here rather than being invented from the cost basis.
    dayChange: 0,
    dayChangePercent: 0,
    isPartiallyPriced,
  };
}
