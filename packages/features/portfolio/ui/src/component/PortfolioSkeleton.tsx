import { useTickrTheme } from '@tickr/core-ui';
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

/**
 * The loading placeholder.
 *
 * The pulse runs on a shared value, so it keeps animating while JavaScript is
 * busy with the first burst of frames from the feed. That is the whole point of
 * a skeleton: it has to look alive precisely when the app is working hardest.
 */
export function PortfolioSkeleton({ rows = 4 }: { rows?: number }) {
  const { colors, spacing, radius } = useTickrTheme();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={{ gap: spacing.sm }}>
      {Array.from({ length: rows }, (_, index) => (
        <Animated.View
          key={index}
          style={[
            {
              height: 88,
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
            },
            animatedStyle,
          ]}
        />
      ))}
    </View>
  );
}

export const skeletonStyles = StyleSheet.create({});
