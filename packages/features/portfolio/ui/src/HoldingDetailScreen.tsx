import {
  AllocationBar,
  BackChevron,
  InteractiveLineChart,
  formatCurrency,
  formatPercent,
  formatQuantity,
  useTickrTheme,
} from '@tickr/core-ui';
import { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { type HoldingUi, type PortfolioUiState } from './model';
import { RangePicker } from './RangePicker';
import { type PortfolioStore } from './store/portfolioStore';
import { usePortfolio } from './store/usePortfolio';

/**
 * One holding, in full.
 *
 * The selectors are per-field rather than one object, for the same reason as
 * the overview: a selector that builds a new object on every call would make
 * `Object.is` always false and the component would re-render on every tick
 * regardless of what changed.
 */
export function HoldingDetailScreen({
  store,
  symbol,
  onBack,
}: {
  store: PortfolioStore;
  symbol: string;
  onBack: () => void;
}) {
  const { colors, spacing, typography } = useTickrTheme();

  const holdingSelector = useMemo(
    () => (state: PortfolioUiState): HoldingUi | undefined =>
      state.holdings.find((candidate) => candidate.symbol === symbol),
    [symbol],
  );
  const holding = usePortfolio(store, holdingSelector);
  const displayedRange = usePortfolio(store, (state) => state.displayedRange);
  const scrubIndex = usePortfolio(store, (state) => state.detailScrubIndex);
  const setRange = store.setRange;
  const setScrubIndex = store.setDetailScrubIndex;
  const removeHolding = store.removeHolding;

  const handleScrub = useCallback((index: number | null) => setScrubIndex(index), [setScrubIndex]);

  const handleRemove = useCallback(() => {
    void removeHolding(symbol).then(onBack);
  }, [removeHolding, symbol, onBack]);

  if (holding === undefined) {
    return (
      <View style={[styles.screen, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          This holding is no longer in the portfolio
        </Text>
      </View>
    );
  }

  const isPositive = holding.returnPercent >= 0;
  const changeColor = isPositive ? colors.positive : colors.negative;
  const scrubbedValue =
    scrubIndex !== null && holding.history[scrubIndex] !== undefined
      ? holding.history[scrubIndex]
      : null;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: spacing.lg }}
    >
      <View style={[styles.headerRow, { gap: spacing.sm, marginBottom: spacing.lg }]}>
        <BackChevron onPress={onBack} />
        <View style={[styles.badge, { backgroundColor: holding.color }]}>
          <Text style={[typography.caption, styles.badgeText]}>{holding.symbol.slice(0, 3)}</Text>
        </View>
        <Text style={[typography.title, { color: colors.textPrimary }]}>{holding.symbol}</Text>
      </View>

      <Text style={[typography.caption, { color: colors.textSecondary }]}>
        {scrubbedValue !== null ? 'AT THIS POINT' : 'CURRENT PRICE'}
      </Text>
      <Text style={[typography.display, { color: colors.textPrimary }]}>
        {formatCurrency(scrubbedValue ?? holding.price)}
      </Text>
      <Text style={[typography.label, { color: changeColor, marginTop: spacing.xs }]}>
        {formatPercent(holding.returnPercent)}
      </Text>

      {holding.history.length >= 2 ? (
        <View style={{ marginTop: spacing.lg }}>
          <InteractiveLineChart
            points={holding.history}
            color={changeColor}
            scrubIndex={scrubIndex}
            onScrub={handleScrub}
            height={200}
          />
        </View>
      ) : null}

      <View style={{ marginTop: spacing.md }}>
        <RangePicker selected={displayedRange} onSelect={setRange} />
      </View>

      <View style={[styles.stats, { marginTop: spacing.xl, gap: spacing.md }]}>
        <Stat label="Quantity" value={formatQuantity(holding.quantity)} />
        <Stat label="Cost basis" value={formatCurrency(holding.costBasis)} />
        <Stat label="Value" value={formatCurrency(holding.value)} />
        <Stat
          label="Profit"
          value={formatCurrency(holding.profit)}
          color={holding.profit >= 0 ? colors.positive : colors.negative}
        />
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
          ALLOCATION
        </Text>
        <AllocationBar
          slices={[{ key: holding.symbol, weight: holding.value, color: holding.color }]}
        />
      </View>

      <Text
        onPress={handleRemove}
        accessibilityRole="button"
        style={[typography.label, { color: colors.negative, marginTop: spacing.xxl }]}
      >
        Remove holding
      </Text>
    </ScrollView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  const { colors, typography } = useTickrTheme();
  return (
    <View style={styles.statRow}>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.mono, { color: color ?? colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#0B0E11',
    fontWeight: '700',
  },
  stats: {
    width: '100%',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
