import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTickrTheme } from '../theme/TickrTheme';

/**
 * The pulsing dot that says the feed is live.
 *
 * The Kotlin version uses `rememberInfiniteTransition` and an `animateFloat`
 * on the alpha. Reanimated's equivalent is `withRepeat(withTiming(...))` on a
 * shared value, and the crucial difference is where it runs: a shared value
 * animated by Reanimated is driven on the UI thread, so the pulse keeps going
 * at 60fps while JavaScript is busy parsing a burst of price frames. A
 * `useState`-driven opacity would stutter exactly when the feed is busiest,
 * which is when the indicator matters most.
 */
export function LiveDot({ status }: { status: 'connecting' | 'live' | 'disconnected' }) {
  const { colors } = useTickrTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (status === 'live') {
      opacity.value = withRepeat(
        withTiming(0.25, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      // Cancelled rather than left running: a disconnected dot that keeps
      // pulsing is a lie, and an animation nobody can see still costs frames.
      cancelAnimation(opacity);
      opacity.value = withTiming(1, { duration: 150 });
    }

    return () => cancelAnimation(opacity);
  }, [status, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const color =
    status === 'live' ? colors.live : status === 'connecting' ? colors.connecting : colors.disconnected;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.dot, { backgroundColor: color }, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
