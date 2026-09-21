import { HoldingDetailScreen } from '@tickr/portfolio-ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../../src/store/StoreProvider';

/**
 * The detail route.
 *
 * The symbol comes from the path rather than from the store's `selectedSymbol`,
 * which is the one place this port deliberately diverges from the Kotlin
 * version. Kotlin keeps the selection in the ViewModel because a shared
 * ViewModel drives both panes on a tablet. Expo Router already owns the
 * selection in the URL, and duplicating it in the store would give two sources
 * of truth that can disagree after a deep link.
 *
 * The consequence is that a deep link to a symbol that is not held renders the
 * screen's own "no longer in the portfolio" state rather than crashing, which
 * is the behaviour the screen was written for.
 */
export default function HoldingDetailRoute() {
  const store = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ symbol: string }>();

  const symbol = typeof params.symbol === 'string' ? params.symbol : '';

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    // A deep link has no history to pop, so it replaces rather than pushes.
    router.replace('/');
  }, [router]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <HoldingDetailScreen store={store} symbol={symbol} onBack={handleBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
