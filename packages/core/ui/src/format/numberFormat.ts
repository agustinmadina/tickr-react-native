/**
 * Number formatting, mirroring the Kotlin NumberFormat.kt.
 *
 * `Intl.NumberFormat` is available in React Native's Hermes engine and in every
 * browser, so unlike the Kotlin version there is no per-platform formatter to
 * write. The Kotlin one has to hand-roll currency formatting because
 * `NumberFormat` is JVM-only and unavailable on Kotlin/Native and wasm.
 *
 * The formatters are constructed once at module scope. Constructing an
 * `Intl.NumberFormat` is expensive, and a price row that formats on every tick
 * would construct one several times a second.
 */

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string, maximumFractionDigits: number): Intl.NumberFormat {
  const key = `${currency}:${maximumFractionDigits}`;
  const existing = currencyFormatters.get(key);
  if (existing !== undefined) return existing;

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits,
  });
  currencyFormatters.set(key, formatter);
  return formatter;
}

/**
 * Prices span nine orders of magnitude: BTC is five figures, SHIB is eight
 * decimal places. A fixed two-decimal format renders SHIB as $0.00, which is
 * not a rounding error, it is a wrong number. The precision is chosen from the
 * magnitude instead.
 */
export function formatCurrency(value: number, currency = 'USD'): string {
  const magnitude = Math.abs(value);

  if (magnitude === 0) return currencyFormatter(currency, 2).format(0);
  if (magnitude >= 1) return currencyFormatter(currency, 2).format(value);
  if (magnitude >= 0.01) return currencyFormatter(currency, 4).format(value);
  if (magnitude >= 0.0001) return currencyFormatter(currency, 6).format(value);
  return currencyFormatter(currency, 8).format(value);
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatQuantity(value: number): string {
  if (value === 0) return '0';
  if (value >= 1) return value.toFixed(4).replace(/\.?0+$/, '');
  return value.toPrecision(6).replace(/\.?0+$/, '');
}

/**
 * For axis labels and allocation percentages, where the exact figure matters
 * less than the order of magnitude.
 */
export function formatCompact(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (magnitude >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (magnitude >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(2);
}
