import { useTickrTheme } from '@tickr/core-ui';
import { HISTORY_RANGES, historyRangeLabel, type HistoryRange } from '@tickr/portfolio-domain';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * The 1H / 1D / 1W / 1M / 1Y selector.
 *
 * The Kotlin version is RangePicker.kt. The one detail worth carrying over is
 * that the selected range is driven by the data, not by the tap: the labels
 * flip when the new series arrives, not when the button is pressed. Tapping
 * 1W and seeing the label change while the chart still shows the day is a lie
 * the user can see.
 */
export function RangePicker({
  selected,
  onSelect,
}: {
  selected: HistoryRange;
  onSelect: (range: HistoryRange) => void;
}) {
  const { colors, spacing, radius, typography } = useTickrTheme();

  return (
    <View style={[styles.row, { gap: spacing.xs }]}>
      {HISTORY_RANGES.map((range) => {
        const isSelected = range === selected;
        return (
          <Pressable
            key={range}
            onPress={() => onSelect(range)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? colors.surfaceElevated : 'transparent',
                borderRadius: radius.pill,
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.md,
              },
            ]}
          >
            <Text
              style={[
                typography.caption,
                { color: isSelected ? colors.textPrimary : colors.textTertiary },
              ]}
            >
              {historyRangeLabel(range)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
