/**
 * Spacing and radius, from the Kotlin Spacing.kt.
 *
 * A 4-point scale, same as the Kotlin one. Named rather than numeric at the
 * call site so a layout reads as intent rather than arithmetic.
 */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export type Spacing = typeof spacing;
