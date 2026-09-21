import { Platform, type TextStyle } from 'react-native';

/**
 * Type scale.
 *
 * The Kotlin version uses the platform default font, which on Android is Roboto
 * and on iOS is SF Pro. React Native does the same thing by omitting
 * `fontFamily`, so the two apps match without either of them shipping a font.
 *
 * `fontVariant: ['tabular-nums']` is the one non-obvious entry. Prices update
 * several times a second, and proportional digits change width as they change,
 * so a number going from 1.11 to 1.19 shifts every character after it and the
 * whole row jitters. Tabular figures are fixed-width, so the row is still.
 */
export const typography = {
  display: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600',
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  mono: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    ...(Platform.OS === 'ios' ? { fontFamily: 'Menlo' } : { fontFamily: 'monospace' }),
  },
} as const satisfies Record<string, TextStyle>;
