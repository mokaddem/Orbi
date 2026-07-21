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

/**
 * Which stage of the map load failed. Surfaced to the player as a short `MAP-…` code (see
 * {@link mapErrorCode}) so a bug report tells us *where* it broke: `'chunk'` — the map component
 * couldn't be code-split in (usually a stale service-worker chunk after a deploy); `'fetch'` — the
 * TopoJSON request failed (offline / non-2xx); `'decode'` — the bytes arrived but weren't valid
 * TopoJSON (truncated download, cache corruption).
 */
export type MapLoadStage = 'chunk' | 'fetch' | 'decode';

/** A staged map-load failure. `stage` (and any HTTP `status`) drive the user-facing error code. */
export class MapLoadError extends Error {
  readonly stage: MapLoadStage;
  readonly status?: number;
  constructor(
    stage: MapLoadStage,
    message: string,
    options: { status?: number; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'MapLoadError';
    this.stage = stage;
    this.status = options.status;
  }
}

/**
 * A short, copy-pasteable code for the map-error card, e.g. `MAP-FETCH-503`, `MAP-DECODE`. Falls
 * back to `MAP-UNKNOWN` for anything that isn't a {@link MapLoadError}. Not a message — it's a
 * debugging handle: it never needs translating, and it's the same in every locale.
 */
export function mapErrorCode(err: unknown): string {
  if (err instanceof MapLoadError) {
    const base = `MAP-${err.stage.toUpperCase()}`;
    return err.status ? `${base}-${err.status}` : base;
  }
  return 'MAP-UNKNOWN';
}

let topologyPromise: Promise<Topology> | null = null;
let featuresPromise: Promise<Map<string, CountryFeature>> | null = null;

/**
 * Fetch and cache the bundled TopoJSON. Loaded at most once per session — but a *rejection* is
 * never cached: the first failure used to poison `topologyPromise` for the whole session, so every
 * later map attempt returned the same rejected promise and failed instantly (even after the network
 * recovered). On any failure we null the memo so a later call — e.g. a Retry tap — re-fetches.
 */
export function loadTopology(): Promise<Topology> {
  if (!topologyPromise) {
    topologyPromise = (async () => {
      let res: Response;
      try {
        res = await fetch(topoUrl);
      } catch (cause) {
        throw new MapLoadError('fetch', 'Could not fetch the map data', { cause });
      }
      if (!res.ok) {
        throw new MapLoadError('fetch', `Map data request failed (${res.status})`, {
          status: res.status,
        });
      }
      try {
        return (await res.json()) as Topology;
      } catch (cause) {
        throw new MapLoadError('decode', 'Map data was not valid JSON', { cause });
      }
    })().catch((err: unknown) => {
      topologyPromise = null; // don't cache a rejection — let a later attempt retry the fetch
      throw err;
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
    featuresPromise = loadTopology()
      .then((topo) => {
        try {
          const collection = feature(topo, topo.objects.countries as GeometryCollection);
          return indexFeaturesByCountry(collection.features);
        } catch (cause) {
          throw new MapLoadError('decode', 'Could not decode the map geometry', { cause });
        }
      })
      .catch((err: unknown) => {
        // Same anti-poison guard as loadTopology: a failed decode/fetch mustn't stick for the
        // session. Re-throw MapLoadErrors as-is so the stage/code survives; wrap anything else.
        featuresPromise = null;
        throw err instanceof MapLoadError
          ? err
          : new MapLoadError('decode', 'Could not build the map', { cause: err });
      });
  }
  return featuresPromise;
}
