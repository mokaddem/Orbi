// Projection helper shared by the Atlas map views. Projects every country once with
// the same Natural Earth projection the game map uses, fit to the whole world (no
// region zoom — the Atlas shows regions *in context*). Pure and DOM-free so it is
// unit-testable and reusable by both the region-detail map and the index thumbnails.
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import type { CountryFeature } from '../../data';

/** A country's projected SVG path, keyed by ISO alpha-2. */
export interface ProjectedCountry {
  iso2: string;
  d: string;
}

/**
 * Project the given country geometry into `width`×`height` logical units, framed to
 * the whole set. Countries that project to nothing are dropped.
 */
export function projectWorld(
  features: Map<string, CountryFeature>,
  width: number,
  height: number,
  margin = 6,
): ProjectedCountry[] {
  const fitTarget: FeatureCollection = {
    type: 'FeatureCollection',
    features: [...features.values()],
  } as FeatureCollection;
  const projection = geoNaturalEarth1().fitExtent(
    [
      [margin, margin],
      [width - margin, height - margin],
    ],
    fitTarget,
  );
  const path = geoPath(projection);
  const out: ProjectedCountry[] = [];
  for (const [iso2, f] of features) {
    const d = path(f);
    if (d) out.push({ iso2, d });
  }
  return out;
}
