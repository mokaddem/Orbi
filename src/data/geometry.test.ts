/// <reference types="node" />
import { describe, it, expect } from 'vitest';
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
