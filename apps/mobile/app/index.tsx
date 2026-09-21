import { AddHoldingSheet, OverviewScreen } from '@tickr/portfolio-ui';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../src/store/StoreProvider';

/**
 * The overview route.
 *
 * The screen itself lives in `@tickr/portfolio-ui` and knows nothing about
 * routing. This file is the adapter: it turns a navigation intent into a
 * callback and a modal into a boolean. That split is what lets the same screen
 * be rendered in a test with no router, and it is the same split the Kotlin
 * project makes between the screen and its navigation host.
 */
export default function OverviewRoute() {
  const store = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isAdding, setIsAdding] = useState(false);

  const handleSelectHolding = useCallback(
    (symbol: string) => router.push(`/holding/${symbol}`),
    [router],
  );

  const handleAddHolding = useCallback(() => setIsAdding(true), []);
  const handleCloseSheet = useCallback(() => setIsAdding(false), []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <OverviewScreen
        store={store}
        onSelectHolding={handleSelectHolding}
        onAddHolding={handleAddHolding}
      />

      <Modal
        visible={isAdding}
        animationType="slide"
        transparent
        onRequestClose={handleCloseSheet}
      >
        <View style={styles.backdrop}>
          <View style={{ paddingBottom: insets.bottom }}>
            <AddHoldingSheet store={store} onClose={handleCloseSheet} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});
