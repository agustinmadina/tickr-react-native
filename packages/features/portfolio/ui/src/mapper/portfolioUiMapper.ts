import { type Holding, type PriceTick } from '@tickr/portfolio-domain';

import { assetColor } from '../assetColors';
import { type HoldingUi } from '../model';

/**
 * Domain holding plus its latest quote, as a UI row.
 *
 * The Kotlin version is PortfolioUiMapper.kt. The one piece of real logic is
 * `withLatest`, which is worth explaining because it is subtle and it is the
 * same in both codebases.
 *
 * The history series comes from the REST candles endpoint and is a few minutes
 * stale by the time it arrives. The live price is current. Drawing the stale
 * series alone means the last point on the chart is not the price shown above
 * it, which reads as a bug. So the final point is replaced with the live price,
 * and the chart ends where the headline says it does.
 */
export function withLatest(day: readonly number[], live: number | undefined): readonly number[] {
  if (day.length === 0) return day;
  if (live === undefined || !Number.isFinite(live) || live <= 0) return day;
  return [...day.slice(0, -1), live];
}

export function toHoldingUi(
  holding: Holding,
  tick: PriceTick | undefined,
  history: readonly number[],
): HoldingUi {
  const price = tick?.price ?? 0;
  const value = price * holding.quantity;
  const cost = holding.costBasis * holding.quantity;
  const profit = value - cost;
  const returnPercent = cost === 0 ? 0 : (profit / cost) * 100;

  return {
    symbol: holding.symbol,
    name: holding.symbol,
    quantity: holding.quantity,
    price,
    value,
    costBasis: holding.costBasis,
    profit,
    returnPercent,
    // The day change needs a previous close, which the live feed does not
    // carry. Zero until the history stream supplies one, rather than invented.
    dayChangePercent: 0,
    history: withLatest(history, tick?.price),
    color: assetColor(holding.symbol),
    isPriced: tick !== undefined,
  };
}
