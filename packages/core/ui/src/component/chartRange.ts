/**
 * Maps a series onto the 0..1 height of a chart, with a floor on how small a
 * move may look big.
 *
 * Plain min/max normalisation stretches whatever it is handed to the full
 * height, so a price that wobbled 0.05% over a few minutes drew exactly the
 * same mountain as one that moved 5%, and the chart said nothing at all about
 * scale. A reader cannot tell drama from rounding, which in a finance app is
 * worse than showing no chart.
 *
 * So the span is at least `MINIMUM_SPAN_FRACTION` of the values themselves, and
 * the series is centred rather than anchored to its minimum: below that floor
 * the line sits flat in the middle, which is what a still market should look
 * like.
 *
 * This is a direct port of `ChartRange.kt`. It is a plain function rather than
 * a component because that is all it is in Kotlin too, and because the two
 * charts below need the same mapping.
 */

/** 0 is the bottom of the chart, 1 the top. */
const CENTRE = 0.5;

/**
 * Half a percent. A typical 24h crypto move is a couple of percent and still
 * fills the chart; a few minutes of ticking is a fraction of a percent and now
 * reads as the flat line it is.
 */
const MINIMUM_SPAN_FRACTION = 0.005;

export interface ChartRange {
  /** 0 is the bottom of the chart, 1 the top. */
  fractionOf(value: number): number;
}

export function createChartRange(points: readonly number[]): ChartRange {
  if (points.length === 0) {
    return { fractionOf: () => CENTRE };
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const midpoint = (min + max) / 2;

  const rawSpan = max - min;
  const floor = Math.abs(midpoint) * MINIMUM_SPAN_FRACTION;
  const span = Math.max(rawSpan, floor);

  // A series of a single value, or of all zeroes, has no span and no floor to
  // fall back on. Dividing by it produces NaN, which Skia renders as nothing at
  // all, so the line collapses to the middle instead.
  if (!(span > 0)) {
    return { fractionOf: () => CENTRE };
  }

  return {
    fractionOf: (value: number) => {
      const fraction = CENTRE + (value - midpoint) / span;
      return Math.max(0, Math.min(1, fraction));
    },
  };
}
