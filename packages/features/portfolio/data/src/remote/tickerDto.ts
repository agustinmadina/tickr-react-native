import { z } from 'zod';

/**
 * The Coinbase ticker frame, validated at the boundary.
 *
 * The Kotlin version is a `@Serializable` data class plus a Json configured
 * with `ignoreUnknownKeys = true`. Zod gives the same tolerance for free
 * (unknown keys are stripped by default) and adds the thing the Kotlin version
 * cannot express: which fields are actually required. `product_id` and `price`
 * are the only two the app reads, so they are the only two that must be
 * present, and a frame missing either is dropped rather than producing a tick
 * with `undefined` in it.
 *
 * `price` arrives as a string, which is why it is coerced rather than typed as
 * a number. Exchanges send decimal strings to avoid float precision loss, and
 * the coercion is where that decision is acknowledged.
 */
export const TickerSchema = z.object({
  type: z.string(),
  product_id: z.string(),
  price: z.coerce.number(),
  time: z.string().optional(),
});

export type TickerDto = z.infer<typeof TickerSchema>;
