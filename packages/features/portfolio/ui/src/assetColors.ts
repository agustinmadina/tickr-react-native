/**
 * A stable colour per asset symbol.
 *
 * The Kotlin version is AssetColors.kt and does the same thing: hash the symbol
 * into a fixed palette, so BTC is always the same colour across the list, the
 * allocation bar and the detail screen without any of them coordinating.
 *
 * The hash is a simple FNV-1a rather than `String.hashCode`, because the two
 * apps should agree on the colour for a given symbol and `hashCode` is a JVM
 * implementation detail. This one is specified, so it produces the same result
 * in Kotlin and in JavaScript.
 */
const PALETTE = [
  '#F7931A', // bitcoin orange
  '#627EEA', // ethereum blue
  '#14F195', // solana green
  '#E6007A', // polkadot pink
  '#2A5ADA', // chainlink blue
  '#F0B90B', // binance yellow
  '#8247E5', // polygon purple
  '#00A3FF', // cardano blue
  '#FF007A', // uniswap pink
  '#2775CA', // usd coin blue
] as const;

export function assetColor(symbol: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < symbol.length; i++) {
    hash ^= symbol.charCodeAt(i);
    // FNV prime, via shifts to stay in 32-bit integer range.
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length] ?? PALETTE[0];
}
