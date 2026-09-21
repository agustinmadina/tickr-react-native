import { useTickrTheme } from '@tickr/core-ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { type PortfolioStore } from './store/portfolioStore';

interface AssetOption {
  readonly symbol: string;
  readonly name: string;
}

/**
 * The add-holding form, mirroring AddHoldingSheet.kt.
 *
 * Two things in here are ports of Kotlin behaviour rather than React defaults.
 *
 * The first is the debounce. The Kotlin ViewModel debounces the search by
 * 250 ms so typing "bitcoin" issues one request, not seven. React has no
 * `debounce` operator, so the timer is explicit and the in-flight request is
 * cancelled when the query changes again. Without the cancellation, a slow
 * response for "bit" can land after a fast one for "bitcoin" and replace the
 * results with stale ones.
 *
 * The second is that the form does not close on submit. The Kotlin version
 * keeps the sheet open and clears the fields, because adding two holdings in a
 * row is the common case and reopening the sheet each time is friction.
 */
export function AddHoldingSheet({
  store,
  onClose,
}: {
  store: PortfolioStore;
  onClose: () => void;
}) {
  const { colors, spacing, radius, typography } = useTickrTheme();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly AssetOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selected, setSelected] = useState<AssetOption | null>(null);
  const [quantity, setQuantity] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchAssets = store.searchAssets;
  const addHolding = store.addHolding;

  // The debounce timer and the request generation. The generation is what makes
  // the cancellation correct: a response is only applied if it belongs to the
  // most recent query, regardless of the order the responses arrive in.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    if (selected !== null) return;

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const generation = generationRef.current + 1;
    generationRef.current = generation;

    timerRef.current = setTimeout(() => {
      void searchAssets(trimmed)
        .then((assets) => {
          if (generationRef.current !== generation) return;
          setResults(assets);
        })
        .catch(() => {
          if (generationRef.current !== generation) return;
          setResults([]);
        })
        .finally(() => {
          if (generationRef.current !== generation) return;
          setIsSearching(false);
        });
    }, 250);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [query, selected, searchAssets]);

  const handleSelect = useCallback((asset: AssetOption) => {
    setSelected(asset);
    setQuery(`${asset.symbol} — ${asset.name}`);
    setResults([]);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelected(null);
    setQuery('');
    setResults([]);
  }, []);

  const parsedQuantity = Number.parseFloat(quantity);
  const parsedCostBasis = Number.parseFloat(costBasis);
  const canSubmit =
    selected !== null &&
    Number.isFinite(parsedQuantity) &&
    parsedQuantity > 0 &&
    Number.isFinite(parsedCostBasis) &&
    parsedCostBasis >= 0 &&
    !isSubmitting;

  const handleSubmit = useCallback(() => {
    if (!canSubmit || selected === null) return;

    setIsSubmitting(true);
    void addHolding(selected.symbol, parsedQuantity, parsedCostBasis)
      .then(() => {
        // Kept open, fields cleared: the Kotlin sheet does the same.
        setSelected(null);
        setQuery('');
        setQuantity('');
        setCostBasis('');
        setResults([]);
      })
      .finally(() => setIsSubmitting(false));
  }, [addHolding, canSubmit, parsedCostBasis, parsedQuantity, selected]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.sheet, { backgroundColor: colors.surface, padding: spacing.lg }]}
    >
      <View style={[styles.headerRow, { marginBottom: spacing.lg }]}>
        <Text style={[typography.title, { color: colors.textPrimary }]}>Add holding</Text>
        <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
          <Text style={[typography.label, { color: colors.textSecondary }]}>Close</Text>
        </Pressable>
      </View>

      <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
        ASSET
      </Text>
      <TextInput
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          if (selected !== null) setSelected(null);
        }}
        placeholder="Search by symbol or name"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="characters"
        autoCorrect={false}
        style={[
          styles.input,
          typography.body,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surfaceElevated,
            borderRadius: radius.md,
            padding: spacing.md,
          },
        ]}
      />

      {isSearching ? (
        <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}

      {results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.symbol}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 220, marginTop: spacing.sm }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSelect(item)}
              accessibilityRole="button"
              style={[styles.resultRow, { paddingVertical: spacing.sm }]}
            >
              <Text style={[typography.label, { color: colors.textPrimary }]}>{item.symbol}</Text>
              <Text
                numberOfLines={1}
                style={[typography.caption, { color: colors.textSecondary, flexShrink: 1 }]}
              >
                {item.name}
              </Text>
            </Pressable>
          )}
        />
      ) : null}

      {selected !== null ? (
        <Pressable onPress={handleClearSelection} accessibilityRole="button">
          <Text style={[typography.caption, { color: colors.accent, marginTop: spacing.sm }]}>
            Clear selection
          </Text>
        </Pressable>
      ) : null}

      <Text
        style={[
          typography.caption,
          { color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.xs },
        ]}
      >
        QUANTITY
      </Text>
      <TextInput
        value={quantity}
        onChangeText={setQuantity}
        placeholder="0.00"
        placeholderTextColor={colors.textTertiary}
        keyboardType="decimal-pad"
        style={[
          styles.input,
          typography.mono,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surfaceElevated,
            borderRadius: radius.md,
            padding: spacing.md,
          },
        ]}
      />

      <Text
        style={[
          typography.caption,
          { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
        ]}
      >
        AVERAGE COST (USD)
      </Text>
      <TextInput
        value={costBasis}
        onChangeText={setCostBasis}
        placeholder="0.00"
        placeholderTextColor={colors.textTertiary}
        keyboardType="decimal-pad"
        style={[
          styles.input,
          typography.mono,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surfaceElevated,
            borderRadius: radius.md,
            padding: spacing.md,
          },
        ]}
      />

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit }}
        style={[
          styles.submit,
          {
            backgroundColor: canSubmit ? colors.accent : colors.surfaceElevated,
            borderRadius: radius.md,
            padding: spacing.md,
            marginTop: spacing.xl,
          },
        ]}
      >
        <Text
          style={[
            typography.label,
            { color: canSubmit ? colors.background : colors.textTertiary, textAlign: 'center' },
          ]}
        >
          {isSubmitting ? 'Adding…' : 'Add to portfolio'}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    width: '100%',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  submit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
