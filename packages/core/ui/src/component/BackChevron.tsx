import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Pressable, StyleSheet } from 'react-native';

import { useTickrTheme } from '../theme/TickrTheme';

/**
 * A back arrow, drawn rather than shipped as an image.
 *
 * The Kotlin version draws it with a `Canvas` too. The reason is the same in
 * both: a vector drawn from a path scales to any density without a set of
 * bitmaps, and this is two lines of geometry.
 */
export function BackChevron({ onPress, size = 24 }: { onPress: () => void; size?: number }) {
  const { colors } = useTickrTheme();

  const path = Skia.Path.Make();
  path.moveTo(size * 0.62, size * 0.22);
  path.lineTo(size * 0.34, size * 0.5);
  path.lineTo(size * 0.62, size * 0.78);

  return (
    <Pressable
      onPress={onPress}
      // The visual is 24 points; the touch target is 44, which is the minimum
      // both Apple and Google publish. A 24-point target is a target people
      // miss, and a back button people miss is a bug report.
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={styles.pressable}
    >
      <Canvas style={{ width: size, height: size }}>
        <Path
          path={path}
          style="stroke"
          strokeWidth={2}
          strokeCap="round"
          strokeJoin="round"
          color={colors.textPrimary}
        />
      </Canvas>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
