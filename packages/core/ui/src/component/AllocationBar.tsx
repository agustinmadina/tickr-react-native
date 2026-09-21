import { StyleSheet, View } from 'react-native';

import { useTickrTheme } from '../theme/TickrTheme';

export interface AllocationSlice {
  readonly key: string;
  readonly weight: number;
  readonly color: string;
}

/**
 * A stacked bar showing how the portfolio is split.
 *
 * The Kotlin version is a `Row` of weighted `Box`es. The same thing works here,
 * and it is worth noting that this is the case where React Native needs no
 * special treatment at all: a flex row with `flex: weight` is exactly what
 * Compose's `weight` modifier does.
 *
 * Weights are normalised rather than trusted. A caller passing raw values that
 * do not sum to one would otherwise produce a bar that overflows or underfills,
 * and the bug would look like a layout problem rather than a data one.
 */
export function AllocationBar({ slices }: { slices: readonly AllocationSlice[] }) {
  const { radius, colors } = useTickrTheme();
  const total = slices.reduce((sum, slice) => sum + slice.weight, 0);

  if (total <= 0) {
    return <View style={[styles.bar, { backgroundColor: colors.surfaceElevated, borderRadius: radius.pill }]} />;
  }

  return (
    <View style={[styles.bar, { borderRadius: radius.pill }]}>
      {slices.map((slice) => (
        <View
          key={slice.key}
          style={{
            flex: slice.weight / total,
            backgroundColor: slice.color,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: 8,
    overflow: 'hidden',
  },
});
