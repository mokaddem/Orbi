// Map framing for region-filtered sessions (Phase 12).
//
// Problem: fitting the projection to the *full geometry* of a filtered region blows
// the bounding box out to nearly half the globe, because M49 regions like "Europe"
// include Russia (geometry reaching ~170°E). The result felt far too zoomed out.
//
// Fix (pure & unit-tested here; the Svelte component just consumes it):
//   1. Reduce each focus country to its geographic **centroid** (not its sprawling
//      geometry), so Russia contributes one point near ~100°E instead of a coastline
//      stretching to the antimeridian.
//   2. Build a **robust** lon/lat box from those centroids: trim points that are both
//      far from the median AND beyond a generous floor (~±60°), so a single isolated
//      outlier (Russia in "Europe") is dropped while genuinely continuous, pole-to-pole
//      spreads (the Americas) are kept whole.
//   3. Pad the box by a small, capped margin so the region fills most of the board but
//      a ring of surrounding countries stays visible (owner's "small context margin").
//   4. Emit a **MultiPoint** sampled over the box. d3-geo's `fitExtent` frames the
//      projection to it correctly; a lat/lon *Polygon* would trip a winding bug that
//      zooms *out* instead of in.
//
// Not antimeridian-aware, so Oceania (spread across the Pacific) stays approximate —
// an accepted limitation for now.

import { geoCentroid } from 'd3-geo';
import type { MultiPoint } from 'geojson';
import type { CountryFeature } from '../../data';
import { inlierMask } from './robust-stats';

/** Context margin as a fraction of the box span… */
const PAD_FRACTION = 0.12;
/** …clamped between these bounds (degrees) so tiny regions still get breathing room
 *  and huge ones don't drift back out to the whole continent. */
const PAD_MIN_DEG = 5;
const PAD_MAX_DEG = 12;
/** Sample the box as an (N+1)×(N+1) grid of points. A dense-enough cloud lets
 *  `fitExtent` account for the projection's curvature (bowed parallels/meridians). */
const GRID_STEPS = 4;

/**
 * Robust [min, max] of a 1-D sample: drop values that are both beyond `MAD_K` MADs
 * and beyond `OUTLIER_FLOOR_DEG` from the median, then take the range of the rest.
 */
function robustRange(values: readonly number[]): [number, number] {
  const keep = inlierMask(values);
  const kept = values.filter((_, i) => keep[i]);
  return [Math.min(...kept), Math.max(...kept)];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Compute a MultiPoint to fit the projection to for a region-filtered session, or
 * `null` if there's nothing to focus on (fall back to a whole-world fit).
 *
 * Pure: depends only on the focus features' geographic centroids, so it can be
 * memoized on `(features, focusIsos)` and unit-tested without a browser.
 */
export function focusFrame(focus: readonly CountryFeature[]): MultiPoint | null {
  if (focus.length === 0) return null;

  const centroids = focus
    .map((f) => geoCentroid(f))
    .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
  if (centroids.length === 0) return null;

  const [rawMinLon, rawMaxLon] = robustRange(centroids.map((c) => c[0]));
  const [rawMinLat, rawMaxLat] = robustRange(centroids.map((c) => c[1]));

  const padLon = clamp((rawMaxLon - rawMinLon) * PAD_FRACTION, PAD_MIN_DEG, PAD_MAX_DEG);
  const padLat = clamp((rawMaxLat - rawMinLat) * PAD_FRACTION, PAD_MIN_DEG, PAD_MAX_DEG);

  const minLon = Math.max(-180, rawMinLon - padLon);
  const maxLon = Math.min(180, rawMaxLon + padLon);
  const minLat = Math.max(-90, rawMinLat - padLat);
  const maxLat = Math.min(90, rawMaxLat + padLat);

  const coordinates: [number, number][] = [];
  for (let i = 0; i <= GRID_STEPS; i++) {
    for (let j = 0; j <= GRID_STEPS; j++) {
      coordinates.push([
        minLon + ((maxLon - minLon) * i) / GRID_STEPS,
        minLat + ((maxLat - minLat) * j) / GRID_STEPS,
      ]);
    }
  }
  return { type: 'MultiPoint', coordinates };
}
