// Pure geometry helpers for the WebGL globe (Phase 38).
//
// No three.js or DOM dependency, so these are unit-testable without a browser. The
// conventions here match THREE.SphereGeometry's default UV layout, so the equirectangular
// country texture (drawn with `lonLatToTexPx`) and raycast picking (`vec3ToLonLat` on a
// hit point) line up exactly on the sphere:
//
//   A = (lon + 180)°, P = (90 − lat)°
//   x = −cos A · sin P,  y = cos P,  z = sin A · sin P
//
// Keep the earth mesh unrotated in the scene so world coords equal local coords and a
// raycast hit can be inverted straight back to lon/lat.

import { geoArea, geoCentroid, geoDistance } from 'd3-geo';
import type { Geometry, MultiPoint, Polygon, Position } from 'geojson';
import { inlierMask } from './robust-stats';

/** Equirectangular country-texture dimensions (px). 2048×1024 keeps borders crisp. */
export const TEX_W = 2048;
export const TEX_H = 1024;

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** Lon/lat (°) → xyz on a sphere of radius `r`. Matches SphereGeometry UVs. */
export function lonLatToVec3(lon: number, lat: number, r = 1): [number, number, number] {
  const a = (lon + 180) * D2R;
  const p = (90 - lat) * D2R;
  return [-Math.cos(a) * Math.sin(p) * r, Math.cos(p) * r, Math.sin(a) * Math.sin(p) * r];
}

/** Inverse of `lonLatToVec3`: sphere xyz → [lon, lat] (°), lon normalised to [−180, 180]. */
export function vec3ToLonLat(x: number, y: number, z: number): [number, number] {
  const len = Math.hypot(x, y, z) || 1;
  const lat = 90 - Math.acos(Math.min(1, Math.max(-1, y / len))) * R2D;
  let lon = Math.atan2(z / len, -x / len) * R2D - 180;
  lon = ((lon + 540) % 360) - 180;
  return [lon, lat];
}

/** Lon/lat (°) → pixel in the equirectangular texture. */
export function lonLatToTexPx(lon: number, lat: number): [number, number] {
  return [((lon + 180) / 360) * TEX_W, ((90 - lat) / 180) * TEX_H];
}

/**
 * Angular radius (radians) of a region: the greatest great-circle distance from its
 * centroid to any member centroid. 0 for an empty/degenerate region.
 */
export function regionAngularRadius(
  centroid: [number, number],
  members: readonly [number, number][],
): number {
  let max = 0;
  for (const m of members) {
    const d = geoDistance(centroid, m);
    if (Number.isFinite(d) && d > max) max = d;
  }
  return max;
}

/**
 * Robust region **centre + angular radius** for framing a filtered region on the globe.
 *
 * The globe analogue of `map-framing.ts`'s `focusFrame`, and the fix for a region whose
 * M49 membership has a far outlier — canonically **Russia in "Europe"** (reaching ~170°E):
 * its centroid otherwise drags the fly-to centre east and inflates the radius, so the
 * globe backs off and recentres over Asia with Europe hidden at the limb. Here we reduce
 * the region to its member centroids, trim points that are outliers on *either* axis (the
 * same MAD + ~±60° floor gate the flat map uses — so Russia is dropped entirely), then
 * derive the centre (spherical centroid of the kept points) and angular radius from the
 * kept set. Falls back to the untrimmed set if trimming would leave nothing.
 *
 * Returns `null` when there are no finite centroids (caller frames the whole world).
 * Pure (only d3-geo), so it is unit-tested without a browser.
 */
export function robustRegionFrame(
  centroids: readonly [number, number][],
): { centre: [number, number]; radius: number } | null {
  const finite = centroids.filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
  if (finite.length === 0) return null;
  const lonKeep = inlierMask(finite.map((c) => c[0]));
  const latKeep = inlierMask(finite.map((c) => c[1]));
  let kept = finite.filter((_, i) => lonKeep[i] && latKeep[i]);
  if (kept.length === 0) kept = finite;
  const mp: MultiPoint = { type: 'MultiPoint', coordinates: kept as Position[] };
  const c = geoCentroid(mp);
  const centre: [number, number] =
    Number.isFinite(c[0]) && Number.isFinite(c[1]) ? [c[0], c[1]] : kept[0];
  return { centre, radius: regionAngularRadius(centre, kept) };
}

/**
 * Camera distance (globe radius = 1) that frames a region of the given angular radius:
 * tighter for compact regions, backing off for sprawling ones, clamped so a point-region
 * doesn't dive inside the globe and a hemisphere-wide one doesn't exceed the world view.
 */
export function fitDistanceForAngularRadius(rad: number): number {
  const MIN = 1.85;
  const MAX = 3.2;
  return Math.min(MAX, Math.max(MIN, 1.5 + rad * 1.9));
}

/**
 * Centroid of a country's **largest-area polygon**, not the spherical centroid of *all* its
 * polygons. For a country with far-flung territory — France + French Guiana, Norway +
 * Svalbard — the all-polygon centroid drifts off the mainland (France's slides south toward
 * South America), so labels, camera framing, and aim-assist anchor to a spot the player
 * doesn't recognise. Anchoring to the biggest landmass keeps them on the mainland, and is
 * identical for single-polygon countries. Falls back to the feature's `geoCentroid` when
 * there are no polygons or the largest one is degenerate.
 */
export function largestPolygonCentroid(geom: Geometry): [number, number] {
  const largest = largestPolygon(geom);
  const c = largest ? geoCentroid(largest) : geoCentroid(geom);
  return Number.isFinite(c[0]) && Number.isFinite(c[1])
    ? [c[0], c[1]]
    : (geoCentroid(geom) as [number, number]);
}

/**
 * A country's **largest-area polygon** as a GeoJSON `Polygon`, or `null` when the geometry has
 * no polygons (`Point` / `LineString` / empty). Areas are compared with `geoArea` (steradians),
 * so the choice is projection-independent — the mainland is the mainland on the globe and on any
 * flat projection alike. This is the shared "mainland selector" behind both the globe's
 * {@link largestPolygonCentroid} and the flat map's mainland anchor (Phase 40): for a country
 * with far-flung territory (France + French Guiana, Norway + Svalbard) it returns the biggest
 * landmass, so labels, framing, and aim-assist anchor to the mainland rather than the
 * all-polygon centre of mass. Identical to the sole polygon for a single-polygon country.
 */
export function largestPolygon(geom: Geometry): Polygon | null {
  let best: Position[][] | null = null;
  let bestArea = -1;
  for (const poly of polygonsOf(geom)) {
    const area = geoArea({ type: 'Polygon', coordinates: poly });
    if (area > bestArea) {
      bestArea = area;
      best = poly;
    }
  }
  return best ? { type: 'Polygon', coordinates: best } : null;
}

/** Flatten a Polygon/MultiPolygon geometry to its list of polygons (each a list of rings). */
export function polygonsOf(geom: Geometry): Position[][][] {
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}

/**
 * Append a geometry's ring outlines to `out` as flat `LineSegments` vertex data (pairs of
 * xyz per edge) on a sphere of the given radius. Rings are antimeridian-split first so no
 * border edge cuts across the globe. Used for the crisp GPU vector borders overlaid on the
 * textured fills (Phase 38 Stage 3) — re-rasterised per frame, so they stay sharp at any
 * zoom where the raster texture would blur.
 */
export function appendBorderSegments(geom: Geometry, radius: number, out: number[]): void {
  for (const poly of polygonsOf(geom)) {
    for (const ring of poly) {
      for (const piece of splitRingAtAntimeridian(ring)) {
        for (let i = 0; i + 1 < piece.length; i++) {
          const a = lonLatToVec3(piece[i][0], piece[i][1], radius);
          const b = lonLatToVec3(piece[i + 1][0], piece[i + 1][1], radius);
          out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
        }
      }
    }
  }
}

/**
 * True if any ring spans more than 180° of longitude — i.e. it crosses the antimeridian
 * (Russia, Fiji, the US Aleutians…). Such a ring must be split at the antimeridian before
 * rasterising or it smears a full-width horizontal band across the equirectangular texture.
 */
export function crossesAntimeridian(geom: Geometry): boolean {
  for (const poly of polygonsOf(geom)) {
    for (const ring of poly) {
      let min = 180;
      let max = -180;
      for (const [lon] of ring) {
        if (lon < min) min = lon;
        if (lon > max) max = lon;
      }
      if (max - min > 180) return true;
    }
  }
  return false;
}

/**
 * Split a polygon ring at the antimeridian into one or more sub-rings, each staying on a
 * single side of ±180° (longitudes stay continuous). This replaces the old ±360°-shifted
 * 3-copy draw, which left the antimeridian seam *inside* each copy — a vertex at ~+180
 * followed by one at ~−180 draws an edge clean across the texture, producing the polar
 * band (Russia's Chukotka reaches ~71°N right at the seam).
 *
 * Each crossing edge is cut at the ±180 boundary (latitude interpolated in unwrapped
 * longitude space) and the walk continues from the opposite boundary. Because a closed
 * ring wraps, the final piece is spliced back onto the first — otherwise starting the walk
 * mid-arc would leave an artificial straight cut through the interior. Each returned piece
 * closes naturally against the texture edge (px 0 / TEX_W), so the fill hugs the seam.
 *
 * Rings that don't cross are returned unchanged in a single-element array.
 */
export function splitRingAtAntimeridian(ring: Position[]): Position[][] {
  if (ring.length < 3) return [ring];

  let crosses = false;
  for (let i = 1; i < ring.length; i++) {
    if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) {
      crosses = true;
      break;
    }
  }
  if (!crosses) return [ring];

  const pieces: Position[][] = [];
  let current: Position[] = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    const [lon0, lat0] = ring[i - 1];
    const [lon1, lat1] = ring[i];
    const dlon = lon1 - lon0;
    if (Math.abs(dlon) > 180) {
      // Crosses the antimeridian. Unwrap lon1 to be continuous with lon0, find where the
      // edge hits ±180, and interpolate the crossing latitude there.
      const lon1u = dlon > 0 ? lon1 - 360 : lon1 + 360;
      const bound = lon0 >= 0 ? 180 : -180;
      const denom = lon1u - lon0;
      const tt = denom === 0 ? 0 : (bound - lon0) / denom;
      const latCross = lat0 + (lat1 - lat0) * tt;
      current.push([bound, latCross]);
      pieces.push(current);
      current = [
        [-bound, latCross],
        [lon1, lat1],
      ];
    } else {
      current.push(ring[i]);
    }
  }
  pieces.push(current);

  // Merge the trailing piece back onto the leading one: both lie on the side the walk
  // started from and are one continuous arc split only by the arbitrary start vertex.
  if (pieces.length > 1) {
    pieces[0] = [...pieces.pop()!, ...pieces[0]];
  }
  return pieces;
}
