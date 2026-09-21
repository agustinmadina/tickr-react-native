import {
  AnimatedAmount,
  InteractiveLineChart,
  LiveDot,
  formatCurrency,
  formatPercent,
  useTickrTheme,
} from '@tickr/core-ui';
import { useCallback } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { HoldingCard } from './component/HoldingCard';
import { PortfolioSkeleton } from './component/PortfolioSkeleton';
import { type HoldingUi } from './model';
import { RangePicker } from './RangePicker';
import { type PortfolioStore } from './store/portfolioStore';
import { usePortfolio } from './store/usePortfolio';

/**
 * The portfolio overview.
 *
 * The selectors below are the point of this file. Each one returns a primitive
 * or a stable reference from the store, so the component re-renders only when
 * that specific value changes. Reading the whole state object here would
 * re-render the entire screen, list included, several times a second.
 *
 * The list itself is a `FlatList` with a `keyExtractor` and a memoised row.
 * `FlatList` virtualises, so a portfolio of fifty holdings only renders the
 * ones on screen, and the memoised row means a tick for BTC does not re-render
 * the ETH row.
 */
export function OverviewScreen({
  store,
  onSelectHolding,
  onAddHolding,
}: {
  store: PortfolioStore;
  onSelectHolding: (symbol: string) => void;
  onAddHolding: () => void;
}) {
  const { colors, spacing, typography } = useTickrTheme();

  const isLoading = usePortfolio(store, (state) => state.isLoading);
  const holdings = usePortfolio(store, (state) => state.holdings);
  const totalValue = usePortfolio(store, (state) => state.totalValue);
  const totalReturnPercent = usePortfolio(store, (state) => state.totalReturnPercent);
  const totalHistory = usePortfolio(store, (state) => state.totalHistory);
  const feedStatus = usePortfolio(store, (state) => state.feedStatus);
  const displayedRange = usePortfolio(store, (state) => state.displayedRange);
  const scrubIndex = usePortfolio(store, (state) => state.overviewScrubIndex);
  const isPartiallyPriced = usePortfolio(store, (state) => state.isPartiallyPriced);

  const setRange = store.setRange;
  const setScrubIndex = store.setOverviewScrubIndex;

  const handleScrub = useCallback(
    (index: number | null) => setScrubIndex(index),
    [setScrubIndex],
  );

  const renderItem = useCallback(
    ({ item }: { item: HoldingUi }) => <HoldingCard holding={item} onPress={onSelectHolding} />,
    [onSelectHolding],
  );

  const keyExtractor = useCallback((item: HoldingUi) => item.symbol, []);

  const isPositive = totalReturnPercent >= 0;
  const changeColor = isPositive ? colors.positive : colors.negative;

  // The headline follows the scrubber while the user is dragging, and falls
  // back to the live total when they let go. That is what makes the chart feel
  // connected to the number above it rather than decorative.
  const scrubbedValue =
    scrubIndex !== null && totalHistory[scrubIndex] !== undefined
      ? totalHistory[scrubIndex]
      : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={holdings}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg }}>
            <View style={[styles.headerRow, { gap: spacing.sm }]}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                TOTAL VALUE
              </Text>
              <LiveDot status={feedStatus} />
            </View>

            {scrubbedValue !== null ? (
              <Text style={[typography.display, { color: colors.textPrimary }]}>
                {formatCurrency(scrubbedValue)}
              </Text>
            ) : (
              <AnimatedAmount value={totalValue} />
            )}

            <Text style={[typography.label, { color: changeColor, marginTop: spacing.xs }]}>
              {formatPercent(totalReturnPercent)}
            </Text>

            {isPartiallyPriced ? (
              <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
                Waiting for quotes on every holding
              </Text>
            ) : null}

            {totalHistory.length >= 2 ? (
              <View style={{ marginTop: spacing.lg }}>
                <InteractiveLineChart
                  points={totalHistory}
                  color={changeColor}
                  scrubIndex={scrubIndex}
                  onScrub={handleScrub}
                  height={180}
                />
              </View>
            ) : null}

            <View style={{ marginTop: spacing.md }}>
              <RangePicker selected={displayedRange} onSelect={setRange} />
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <PortfolioSkeleton />
          ) : (
            <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>
                No holdings yet
              </Text>
              <Text
                style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}
              >
                Add one to start tracking
              </Text>
            </View>
          )
        }
      />

      <View style={[styles.footer, { padding: spacing.lg }]}>
        <Text
          onPress={onAddHolding}
          accessibilityRole="button"
          style={[typography.label, { color: colors.accent }]}
        >
          + Add holding
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: {
    alignItems: 'center',
  },
});
