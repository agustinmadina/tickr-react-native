/**
 * The palette, copied from the Kotlin Color.kt.
 *
 * Values are duplicated rather than shared because there is no mechanism to
 * share them: the Kotlin app and this one are separate builds. Keeping the hex
 * strings identical is what makes the two apps look like the same product, and
 * that is a manual discipline, not a technical guarantee.
 */
export const colors = {
  background: '#0B0E11',
  surface: '#151A21',
  surfaceElevated: '#1E252E',
  border: '#2A323D',

  textPrimary: '#F5F7FA',
  textSecondary: '#9AA5B1',
  textTertiary: '#5C6773',

  accent: '#4C8DFF',
  positive: '#2ECC71',
  negative: '#FF5C5C',
  warning: '#F5A623',

  live: '#2ECC71',
  connecting: '#F5A623',
  disconnected: '#5C6773',
} as const;

export type TickrColors = typeof colors;
