import { describe, expect, it } from 'vitest';

import { createChartRange } from './chartRange';

/**
 * Port of `ChartRangeSpec.kt`, case for case.
 *
 * The Kotlin spec creates its state inside each `Then` because Kotest's
 * isolation modes are silently ignored on Kotlin/Native. That concern does not
 * exist here, but the cases are kept one-to-one so the two suites can be read
 * side by side.
 */
describe('createChartRange', () => {
  describe('a series that moved enough to be worth drawing', () => {
    it('maps the extremes to the top and the bottom', () => {
      // A 10% swing is far past the floor, so nothing is compressed.
      const scale = createChartRange([90, 95, 100]);

      expect(scale.fractionOf(90)).toBe(0);
      expect(scale.fractionOf(100)).toBe(1);
      expect(scale.fractionOf(95)).toBeCloseTo(0.5, 6);
    });
  });

  describe('a series that barely moved', () => {
    it('stays near the middle instead of filling the height', () => {
      // 0.05% of the value, the kind of wobble a few minutes of ticking
      // produces. Plain min/max normalisation drew this as a full-height
      // mountain, so a reader could not tell it from a real move.
      const scale = createChartRange([78_000, 78_040]);

      expect(scale.fractionOf(78_000)).toBeGreaterThan(0.4);
      expect(scale.fractionOf(78_040)).toBeLessThan(0.6);
    });
  });

  describe('a series that never changed at all', () => {
    it('puts every point on the centre line', () => {
      const scale = createChartRange([42, 42, 42]);

      expect(scale.fractionOf(42)).toBeCloseTo(0.5, 6);
    });
  });

  describe('a series of zeroes, which has no magnitude to scale against', () => {
    it('is centred rather than dividing by zero', () => {
      const scale = createChartRange([0, 0]);

      expect(scale.fractionOf(0)).toBeCloseTo(0.5, 6);
    });
  });

  describe('a value outside the series', () => {
    it('is clamped to the chart rather than drawn off it', () => {
      const scale = createChartRange([90, 100]);

      expect(scale.fractionOf(1_000)).toBe(1);
      expect(scale.fractionOf(0)).toBe(0);
    });
  });

  describe('an empty series', () => {
    it('is centred rather than throwing on Math.min of nothing', () => {
      // `Math.min()` with no arguments is `Infinity`, so an unguarded port
      // would produce NaN here and Skia would draw nothing.
      const scale = createChartRange([]);

      expect(scale.fractionOf(0)).toBeCloseTo(0.5, 6);
    });
  });
});
