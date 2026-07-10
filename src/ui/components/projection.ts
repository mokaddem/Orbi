// Maps the `mapProjection` preference (Phase 28) to a fresh D3-geo projection.
//
// Kept a tiny pure helper so `WorldMap.svelte` stays declarative and this mapping is
// unit-testable. Every entry is a *planar* projection that `fitExtent` can size to the
// board — no rotation/clipping — so the caller's "project once per session" pass and its
// centroid math (marker + micro-state hit-dots) work unchanged across all of them.
//
// Only the constructors referenced here are pulled from `d3-geo`, so the bundle carries
// just the offered projections (tree-shaken), and it all works offline.

import {
  geoEqualEarth,
  geoEquirectangular,
  geoMercator,
  geoNaturalEarth1,
  type GeoProjection,
} from 'd3-geo';
import type { MapProjection } from '../../data';

const CONSTRUCTORS: Record<MapProjection, () => GeoProjection> = {
  naturalEarth: geoNaturalEarth1,
  equalEarth: geoEqualEarth,
  equirectangular: geoEquirectangular,
  mercator: geoMercator,
};

/**
 * Return a fresh (un-fit) projection for the given preference. Falls back to Natural
 * Earth — the historical default — for any unknown value, so a corrupted pref never
 * breaks the map.
 */
export function projectionFor(name: MapProjection): GeoProjection {
  return (CONSTRUCTORS[name] ?? geoNaturalEarth1)();
}
