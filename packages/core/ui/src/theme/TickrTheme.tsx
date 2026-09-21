import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { colors, type TickrColors } from './colors';
import { radius, spacing } from './spacing';
import { typography } from './typography';

/**
 * The theme, as a React context.
 *
 * Compose has `MaterialTheme` and a `CompositionLocal` for anything it does not
 * cover, so `TickrTheme` in the Kotlin project is a composable that wraps the
 * tree. React has context, which is the same idea with a different spelling.
 *
 * The theme is a plain object rather than a hook per token, because a hook per
 * token would mean a context read per token and that is a re-render per token.
 * One read, one object, and the object is memoised so its identity is stable.
 */
export interface TickrTheme {
  readonly colors: TickrColors;
  readonly spacing: typeof spacing;
  readonly radius: typeof radius;
  readonly typography: typeof typography;
}

const defaultTheme: TickrTheme = { colors, spacing, radius, typography };

const ThemeContext = createContext<TickrTheme>(defaultTheme);

export function TickrThemeProvider({
  children,
  theme = defaultTheme,
}: {
  children: ReactNode;
  theme?: TickrTheme;
}) {
  // Memoised on the theme itself: an inline object literal passed as a prop
  // would be a new identity on every render of the parent, and every consumer
  // would re-render with it.
  const value = useMemo(() => theme, [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTickrTheme(): TickrTheme {
  return useContext(ThemeContext);
}
