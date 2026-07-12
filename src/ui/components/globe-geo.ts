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

import { geoDistance } from 'd3-geo';
import type { Geometry, Position } from 'geojson';

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
 * Camera distance (globe radius = 1) that frames a region of the given angular radius:
 * tighter for compact regions, backing off for sprawling ones, clamped so a point-region
 * doesn't dive inside the globe and a hemisphere-wide one doesn't exceed the world view.
 */
export function fitDistanceForAngularRadius(rad: number): number {
  const MIN = 1.85;
  const MAX = 3.2;
  return Math.min(MAX, Math.max(MIN, 1.5 + rad * 1.9));
}

/** Flatten a Polygon/MultiPolygon geometry to its list of polygons (each a list of rings). */
export function polygonsOf(geom: Geometry): Position[][][] {
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}

/**
 * True if any ring spans more than 180° of longitude — i.e. it crosses the antimeridian.
 * Such a ring must also be drawn ±360°-shifted or it smears horizontally across the
 * equirectangular texture (Russia, Fiji, the US Aleutians…).
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
