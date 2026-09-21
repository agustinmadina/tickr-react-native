import { TickrThemeProvider, colors } from '@tickr/core-ui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StoreProvider } from '../src/store/StoreProvider';

/**
 * The root layout, and the three providers that have to wrap everything.
 *
 * `GestureHandlerRootView` is not optional and it is the one that is easy to
 * forget: without it the pan gesture on the chart silently does nothing on
 * Android, with no error. It has to be the outermost view and it has to have
 * `flex: 1`, or the app renders a zero-height tree.
 *
 * `SafeAreaProvider` is what the Kotlin project gets from the platform window
 * insets. The screens read it through `useSafeAreaInsets` rather than hardcoding
 * a top padding, because the notch height differs per device and the web build
 * has none.
 *
 * The theme is dark-only, matching the Kotlin app, so the status bar is light
 * and the navigation background is set here rather than per screen. A white
 * flash between screens is the usual symptom of getting this wrong.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TickrThemeProvider>
          <StoreProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="holding/[symbol]" />
            </Stack>
          </StoreProvider>
        </TickrThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
