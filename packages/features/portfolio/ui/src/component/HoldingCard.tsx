import { Sparkline, formatCurrency, formatPercent, useTickrTheme } from '@tickr/core-ui';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type HoldingUi } from '../model';

/**
 * One row in the holdings list.
 *
 * `memo` is doing real work here and it is not a micro-optimisation. Prices
 * arrive several times a second, and without it every row re-renders on every
 * tick for every symbol, so a ten-holding portfolio does ten row renders per
 * tick. With it, a row re-renders only when its own props change, which is
 * when its own price changes.
 *
 * The comparison is the default shallow one, which is correct because the
 * parent passes a stable `holding` object from the store and a stable
 * `onPress` from `useCallback`. Passing an inline arrow would defeat `memo`
 * entirely, which is the most common way this optimisation is silently lost.
 */
export const HoldingCard = memo(function HoldingCard({
  holding,
  onPress,
}: {
  holding: HoldingUi;
  onPress: (symbol: string) => void;
}) {
  const { colors, spacing, radius, typography } = useTickrTheme();
  const isPositive = holding.returnPercent >= 0;
  const changeColor = isPositive ? colors.positive : colors.negative;

  return (
    <Pressable
      onPress={() => onPress(holding.symbol)}
      accessibilityRole="button"
      accessibilityLabel={`${holding.symbol}, ${formatCurrency(holding.value)}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
          borderRadius: radius.lg,
          padding: spacing.lg,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <View style={[styles.row, { gap: spacing.md }]}>
        <View style={[styles.badge, { backgroundColor: holding.color, borderRadius: radius.pill }]}>
          <Text style={[typography.caption, styles.badgeText]}>{holding.symbol.slice(0, 3)}</Text>
        </View>

        <View style={styles.grow}>
          <Text style={[typography.label, { color: colors.textPrimary }]} numberOfLines={1}>
            {holding.symbol}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
            {holding.isPriced ? formatCurrency(holding.price) : 'Waiting for quote'}
          </Text>
        </View>

        <View style={styles.right}>
          <Text style={[typography.mono, { color: colors.textPrimary }]}>
            {formatCurrency(holding.value)}
          </Text>
          <Text style={[typography.caption, { color: changeColor }]}>
            {formatPercent(holding.returnPercent)}
          </Text>
        </View>
      </View>

      {holding.history.length >= 2 ? (
        <View style={[styles.sparkline, { marginTop: spacing.md }]}>
          <Sparkline
            points={holding.history}
            color={changeColor}
            width={280}
            height={36}
          />
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#0B0E11',
    fontWeight: '700',
  },
  grow: {
    flex: 1,
  },
  right: {
    alignItems: 'flex-end',
  },
  sparkline: {
    alignItems: 'flex-start',
  },
});
