import { Canvas, Path, Skia, LinearGradient, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTickrTheme } from '../theme/TickrTheme';

import { createChartRange } from './chartRange';

/**
 * A small line chart with a gradient fill, for a row in the holdings list.
 *
 * The Kotlin version draws this with Compose's `Canvas` and `Path`. Skia is the
 * same drawing engine underneath Compose Multiplatform, so the primitives are
 * the same: build a path, stroke it, fill under it with a gradient. The API is
 * lower level and more verbose, which is the honest trade for having the same
 * renderer on every platform.
 *
 * The path is memoised on the points. Rebuilding a `SkPath` on every render of
 * a row that re-renders on every price tick would allocate a native object
 * several times a second per row, and those are not garbage collected cheaply.
 */
export function Sparkline({
  points,
  color,
  width,
  height,
}: {
  points: readonly number[];
  color: string;
  width: number;
  height: number;
}) {
  const { colors } = useTickrTheme();

  const { linePath, fillPath } = useMemo(() => {
    // Fewer than two points is not a line. The Kotlin version returns a Spacer
    // here, and the reason is the same: emitting nothing would drop the
    // caller's sizing along with it, so the container keeps its height.
    if (points.length < 2) {
      return { linePath: null, fillPath: null };
    }

    // Same mapping as the big chart, and for the same reason: a row whose price
    // moved 0.05% must not draw the same shape as one that moved 5%. A flat
    // series collapses to the middle rather than dividing by zero, which Skia
    // would render as nothing at all.
    const range = createChartRange(points);
    const stepX = width / (points.length - 1);

    const yFor = (value: number) => (1 - range.fractionOf(value)) * height;

    const line = Skia.Path.Make();
    const fill = Skia.Path.Make();

    points.forEach((value, index) => {
      const x = index * stepX;
      const y = yFor(value);
      if (index === 0) {
        line.moveTo(x, y);
        fill.moveTo(x, height);
        fill.lineTo(x, y);
      } else {
        line.lineTo(x, y);
        fill.lineTo(x, y);
      }
    });

    fill.lineTo(width, height);
    fill.close();

    return { linePath: line, fillPath: fill };
  }, [points, width, height]);

  if (linePath === null || fillPath === null) {
    return <View style={[styles.placeholder, { width, height }]} />;
  }

  return (
    <Canvas style={{ width, height }}>
      <Path path={fillPath} opacity={0.18}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={[color, colors.background]}
        />
      </Path>
      <Path path={linePath} style="stroke" strokeWidth={1.5} color={color} strokeJoin="round" />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: 'transparent',
  },
});
