import { Canvas, Circle, Line, Path, Skia, vec } from '@shopify/react-native-skia';
import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import { useTickrTheme } from '../theme/TickrTheme';

import { createChartRange } from './chartRange';

const MINIMUM_POINTS = 2;

/**
 * A line chart the user can run a finger along, reporting which sample they are
 * on.
 *
 * This is the component where the two frameworks differ most, and the Kotlin
 * version's comments explain why the problem is hard rather than why the
 * solution is Kotlin-specific. All three of its findings carry over:
 *
 * 1. Input has to be handled twice. A horizontal drag covers touch; a pointer
 *    loop watching movement with nothing pressed covers a mouse hovering with
 *    no button held. One is useless on a phone, the other is useless in a
 *    browser. Here the drag is `Gesture.Pan()` and the hover is
 *    `onPointerMove` on the container, which React Native Web provides.
 *
 * 2. The drag detector must be horizontal only, so the chart can live inside a
 *    vertically scrolling list. `activeOffsetX` is the declarative equivalent
 *    of the Kotlin `awaitHorizontalTouchSlopOrCancellation`, and it is the
 *    reason scrolling past the chart still works.
 *
 * 3. The scrub index is reported on touch down, before any movement. A drag
 *    detector only fires once the finger has travelled past the touch slop, so
 *    waiting for it made the marker appear a few millimetres late and the chart
 *    read as unresponsive.
 *
 * The one thing that does not carry over is `rememberUpdatedState`. The Kotlin
 * version needs it because its gesture handlers are keyed on `Unit` and would
 * otherwise capture a stale point count. Here the gesture is rebuilt when the
 * points change, which is the React idiom, and the shared value holds the
 * current count for the worklet to read.
 */
export function InteractiveLineChart({
  points,
  color,
  scrubIndex,
  onScrub,
  height = 180,
}: {
  points: readonly number[];
  color: string;
  scrubIndex: number | null;
  onScrub: (index: number | null) => void;
  height?: number;
}) {
  const { colors } = useTickrTheme();
  const width = useSharedValue(0);
  const pointCount = useSharedValue(points.length);

  pointCount.value = points.length;

  const { linePath, range } = useMemo(() => {
    if (points.length < MINIMUM_POINTS) {
      return { linePath: null, range: null };
    }
    // The range is not plain min/max. See `chartRange.ts`: a series that moved
    // 0.05% must not draw the same mountain as one that moved 5%.
    const chartRange = createChartRange(points);
    const stepX = 1 / (points.length - 1);

    const path = Skia.Path.Make();
    points.forEach((value, index) => {
      const x = index * stepX;
      const y = 1 - chartRange.fractionOf(value);
      if (index === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });

    return { linePath: path, range: chartRange };
  }, [points]);

  const reportIndex = useCallback(
    (x: number, totalWidth: number) => {
      if (totalWidth <= 0 || points.length < MINIMUM_POINTS) {
        onScrub(null);
        return;
      }
      const ratio = Math.max(0, Math.min(1, x / totalWidth));
      const index = Math.round(ratio * (points.length - 1));
      onScrub(index);
    },
    [points.length, onScrub],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Horizontal only, so a vertical swipe reaches the list underneath.
        // Without this the chart swallows the scroll and the list is stuck.
        .activeOffsetX([-10, 10])
        .onBegin((event) => {
          // Report on the touch down itself, before any movement. See note 3.
          runOnJS(reportIndex)(event.x, width.value);
        })
        .onChange((event) => {
          runOnJS(reportIndex)(event.x, width.value);
        })
        .onFinalize(() => {
          runOnJS(onScrub)(null);
        }),
    [reportIndex, onScrub, width],
  );

  const handlePointerMove = useCallback(
    (event: { nativeEvent: { locationX: number; buttons?: number } }) => {
      // Hover only. A finger dragging also emits movement, and handling those
      // here would re-set the marker immediately after the pan above dismissed
      // it, leaving the scrubber stuck on screen after a vertical scroll.
      if ((event.nativeEvent.buttons ?? 0) !== 0) return;
      reportIndex(event.nativeEvent.locationX, width.value);
    },
    [reportIndex, width],
  );

  const handlePointerLeave = useCallback(() => onScrub(null), [onScrub]);

  if (linePath === null) {
    return <View style={[styles.placeholder, { height }]} />;
  }

  const scrubRatio =
    scrubIndex === null || points.length < MINIMUM_POINTS
      ? null
      : scrubIndex / (points.length - 1);
  const scrubValue = scrubIndex === null ? null : points[scrubIndex];

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={(event) => {
        width.value = event.nativeEvent.layout.width;
      }}
      // @ts-expect-error onPointerMove is a React Native Web prop, absent from
      // the native View typings. It is the only way to get hover on web, and it
      // is inert on native, so the cast is contained to this one prop.
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <GestureDetector gesture={pan}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Path
            path={linePath}
            style="stroke"
            strokeWidth={2}
            color={color}
            strokeJoin="round"
            strokeCap="round"
            transform={[{ scaleX: width.value }, { scaleY: height }]}
          />

          {scrubRatio !== null && scrubValue !== null && scrubValue !== undefined ? (
            <>
              <Line
                p1={vec(scrubRatio * width.value, 0)}
                p2={vec(scrubRatio * width.value, height)}
                color={colors.textTertiary}
                strokeWidth={1}
              />
              <Circle
                cx={scrubRatio * width.value}
                // The marker uses the same mapping as the line. Computing it
                // from raw min/max here would put the dot off the line whenever
                // the minimum-span floor kicked in, which is exactly the case
                // the floor exists for.
                cy={range === null ? height / 2 : (1 - range.fractionOf(scrubValue)) * height}
                r={4}
                color={color}
              />
            </>
          ) : null}
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  placeholder: {
    width: '100%',
  },
});
