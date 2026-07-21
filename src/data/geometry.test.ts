/// <reference types="node" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { indexFeaturesByCountry, type CountryFeature } from './geometry';
import { getCountries } from './countries';

// Decode the bundled TopoJSON directly (no fetch) so the pure join is testable.
const topo = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/data/generated/countries-50m.json'), 'utf8'),
) as Topology;

const features = feature(topo, topo.objects.countries as GeometryCollection)
  .features as CountryFeature[];

describe('indexFeaturesByCountry', () => {
  const byIso2 = indexFeaturesByCountry(features);

  it('joins geometry to every country that has it (194/195)', () => {
    const withGeometry = getCountries().filter((c) => c.hasGeometry);
    expect(byIso2.size).toBe(withGeometry.length);
    expect(byIso2.size).toBe(194);
  });

  it('resolves geometry for a sample of countries', () => {
    for (const iso2 of ['FR', 'DE', 'BR', 'JP', 'US']) {
      const f = byIso2.get(iso2);
      expect(f, iso2).toBeDefined();
      expect(['Polygon', 'MultiPolygon']).toContain(f!.geometry.type);
    }
  });

  it('omits countries with no bundled geometry (Tuvalu)', () => {
    expect(byIso2.has('TV')).toBe(false);
  });

  it('only includes in-scope countries', () => {
    const inScope = new Set(getCountries().map((c) => c.iso2));
    for (const iso2 of byIso2.keys()) {
      expect(inScope.has(iso2)).toBe(true);
    }
  });
});

// The load path (fetch → decode → join) is memoized at module scope, so each case gets a fresh
// module via `vi.resetModules()` + dynamic import, with `fetch` stubbed. The key guarantee: a
// *rejection* is never cached — this was the "Could not load the map several times in a row" bug,
// where one failure poisoned the promise for the whole session.
describe('loadCountryFeatures / loadTopology error handling', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports a fetch-stage error and does NOT cache the rejection (retry succeeds)', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('network down'); // one transient failure, then recovery
      return new Response(JSON.stringify(topo), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { loadCountryFeatures, MapLoadError, mapErrorCode } = await import('./geometry');

    // First attempt rejects with a staged error → MAP-FETCH.
    const err = await loadCountryFeatures().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MapLoadError);
    expect(mapErrorCode(err)).toBe('MAP-FETCH');

    // The rejection wasn't memoized, so a second attempt re-fetches and succeeds — the whole point.
    const byIso2 = await loadCountryFeatures();
    expect(byIso2.size).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('encodes the HTTP status of a non-ok response (MAP-FETCH-503)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('service unavailable', { status: 503 })),
    );
    const { loadTopology, mapErrorCode } = await import('./geometry');
    const err = await loadTopology().catch((e: unknown) => e);
    expect(mapErrorCode(err)).toBe('MAP-FETCH-503');
  });

  it('flags malformed data as a decode-stage error (MAP-DECODE)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<<not json>>', { status: 200 })),
    );
    const { loadTopology, mapErrorCode } = await import('./geometry');
    const err = await loadTopology().catch((e: unknown) => e);
    expect(mapErrorCode(err)).toBe('MAP-DECODE');
  });
});
