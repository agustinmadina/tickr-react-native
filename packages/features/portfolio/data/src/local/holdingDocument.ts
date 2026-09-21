import { z } from 'zod';

/**
 * The stored holdings document.
 *
 * The Kotlin version is a `HoldingEntity` with a `@Serializable` annotation and
 * a mapper to the domain `Holding`. The mapper is kept here too, because the
 * stored shape and the domain shape are allowed to diverge and pretending
 * otherwise is how a storage migration becomes a rewrite.
 */
export const HoldingSchema = z.object({
  symbol: z.string().min(1),
  quantity: z.number().finite().nonnegative(),
  costBasis: z.number().finite().nonnegative(),
});

export const HoldingsDocumentSchema = z.object({
  version: z.literal(1),
  holdings: z.array(HoldingSchema),
});

export type HoldingsDocument = z.infer<typeof HoldingsDocumentSchema>;
