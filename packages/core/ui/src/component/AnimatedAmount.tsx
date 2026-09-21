import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { formatCurrency } from '../format/numberFormat';
import { useTickrTheme } from '../theme/TickrTheme';

/**
 * A currency figure that counts to its new value instead of jumping.
 *
 * This is the component where the two frameworks diverge most, and the first
 * version of this file got it wrong in a way worth recording.
 *
 * In Compose, `AnimatedAmount` holds an `Animatable<Float>` and the text is
 * recomposed on every animation frame. That is fine there, because Compose's
 * recomposition is scoped to the composable and the text node is the only thing
 * that changes.
 *
 * The direct React port of that recomposes the component sixty times a second,
 * so the first version avoided it the way Reanimated suggests: the animation
 * lived in a shared value and the *string itself* was animated, via
 * `useAnimatedProps` on an `Animated.Text`, so React never re-rendered at all.
 *
 * That optimisation does not survive contact with the web build, which for this
 * project is the primary target rather than a fallback. `useAnimatedProps`
 * animates a native text node, and react-native-web has no implementation of
 * it: the props are dropped and the node renders *empty*. The failure is not an
 * error but a silently blank headline, which is strictly worse, because the
 * screen still looks like a screen. On native, animating text content needs an
 * `Animated.TextInput` rather than an `Animated.Text`, and that brings its own
 * padding and font metrics that would not match the Compose original.
 *
 * So the number is interpolated in React instead. The cost is one text node
 * re-rendering per frame for the 450ms of the animation. The benefit is a single
 * implementation that is correct on all three platforms and type-checks against
 * the libraries' published types, rather than a cast that hides the problem.
 * Animating *styles* still goes through Reanimated, where it is supported
 * everywhere; `LiveDot` does exactly that.
 *
 * The easing is cubic out, matching `Easing.out(Easing.cubic)` in the Kotlin
 * version, so the two arrive at the value identically.
 */

interface AnimatedAmountProps {
  value: number;
  currency?: string;
  style?: object;
}

const DURATION_MS = 450;

export function AnimatedAmount({ value, currency = 'USD', style }: AnimatedAmountProps) {
  const { typography, colors } = useTickrTheme();
  const [display, setDisplay] = useState(value);

  // Where the last animation finished, which is also where the current one
  // starts. A ref rather than state because it must not trigger a render.
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };

    frame = requestAnimationFrame(tick);
    // A new value mid-animation cancels the old frame and starts from wherever
    // the interrupted animation had reached, so a burst of price ticks does not
    // queue up a backlog of animations that each run to completion.
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <Text style={[typography.display, { color: colors.textPrimary }, styles.text, style]}>
      {formatAmount(display, currency)}
    </Text>
  );
}

/**
 * Formatting for the animation, which is deliberately not `formatCurrency`.
 *
 * `formatCurrency` picks its precision from the magnitude, so a headline
 * counting from `$0` to `$12,340.55` would change its own decimal places
 * mid-flight and the digits would jitter. This fixes two decimals for the whole
 * count, then the settled value is what the caller passes to `formatCurrency`
 * wherever exact precision matters.
 */
function formatAmount(value: number, currency: string): string {
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(2);
  const [whole = '0', fraction = '00'] = fixed.split('.');

  let grouped = '';
  for (let i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 === 0) grouped += ',';
    grouped += whole[i];
  }

  const symbol = currency === 'USD' ? '$' : `${currency} `;
  return `${negative ? '-' : ''}${symbol}${grouped}.${fraction}`;
}

const styles = StyleSheet.create({
  text: {
    // Tabular figures, so the number does not change width as it counts.
    fontVariant: ['tabular-nums'],
  },
});

export { formatCurrency };
