// Robust 1-D outlier trimming, shared by the flat-map framing (Phase 12, `map-framing.ts`)
// and the globe region framing (Phase 38, `globe-geo.ts`).
//
// A value is an "inlier" if it sits within a threshold of the median, where the threshold
// is the larger of `MAD_K` median-absolute-deviations and a generous fixed floor. That
// keeps genuinely wide but continuous spreads (the Americas, pole to pole) whole while
// dropping a single far isolated outlier — canonically **Russia's centroid in "Europe"**
// (M49), which otherwise drags a region's centre east and inflates its span.

/** Keep values within this many degrees of the median even when the spread is tight, so
 *  continuous regions aren't over-trimmed. Only a *far* isolated outlier (beyond both this
 *  floor and the MAD gate) is dropped. */
export const OUTLIER_FLOOR_DEG = 60;
/** Outlier gate as a multiple of the median absolute deviation. */
export const MAD_K = 3;

/** Median of an already-sorted array (`NaN` for an empty array). */
export function median(sorted: readonly number[]): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const mid = n >> 1;
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Boolean mask over `values`: `true` where the value is an inlier — within
 * `max(MAD_K · MAD, OUTLIER_FLOOR_DEG)` of the median. An empty input yields an empty
 * mask; with ≤ 2 values (MAD 0, threshold = floor) everything within the floor is kept.
 */
export function inlierMask(values: readonly number[]): boolean[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const med = median(sorted);
  const devs = sorted.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
  const mad = median(devs);
  const threshold = Math.max(MAD_K * mad, OUTLIER_FLOOR_DEG);
  return values.map((v) => Math.abs(v - med) <= threshold);
}
