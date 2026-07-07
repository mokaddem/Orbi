// Lazy TopoJSON geometry loader (Phase 1).
//
// The map geometry (~750 KB) is bundled separately from the country dataset and
// loaded on demand, so non-map screens never pay for it. Countries are joined to
// their geometry by numeric ISO code.

import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { Feature, GeoJsonProperties, Geometry } from 'geojson';
import topoUrl from './generated/countries-50m.json?url';
import type { Country } from './types';
import { getCountries } from './countries';

/** A country's map geometry as a GeoJSON feature. */
export type CountryFeature = Feature<Geometry, GeoJsonProperties>;

let topologyPromise: Promise<Topology> | null = null;
let featuresPromise: Promise<Map<string, CountryFeature>> | null = null;

/** Fetch and cache the bundled TopoJSON. Loaded at most once per session. */
export function loadTopology(): Promise<Topology> {
  if (!topologyPromise) {
    topologyPromise = fetch(topoUrl).then((res) => {
      if (!res.ok) throw new Error(`Failed to load TopoJSON (${res.status})`);
      return res.json() as Promise<Topology>;
    });
  }
  return topologyPromise;
}

/**
 * Join decoded GeoJSON features to countries by numeric ISO code, returning a
 * map keyed by ISO alpha-2. Pure and framework-free so it can be unit-tested.
 */
export function indexFeaturesByCountry(
  features: readonly CountryFeature[],
  list: readonly Country[] = getCountries(),
): Map<string, CountryFeature> {
  const byNumericId = new Map<string, CountryFeature>();
  for (const f of features) {
    if (f.id != null) byNumericId.set(String(Number(f.id)), f);
  }
  const result = new Map<string, CountryFeature>();
  for (const c of list) {
    const f = byNumericId.get(String(Number(c.numericId)));
    if (f) result.set(c.iso2, f);
  }
  return result;
}

/**
 * Load the TopoJSON and return each country's geometry, keyed by ISO alpha-2.
 * Memoized: the decode + join runs at most once per session, so a map component
 * remounting across questions reuses the same feature index.
 */
export function loadCountryFeatures(): Promise<Map<string, CountryFeature>> {
  if (!featuresPromise) {
    featuresPromise = loadTopology().then((topo) => {
      const collection = feature(topo, topo.objects.countries as GeometryCollection);
      return indexFeaturesByCountry(collection.features);
    });
  }
  return featuresPromise;
}
