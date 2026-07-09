/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getCountries,
  countryCount,
  getCountry,
  flagUrl,
  getRegions,
  getSubregions,
  getCountriesByRegion,
  getCountriesBySubregion,
  getRegionTree,
} from './countries';
import meta from './generated/meta.json';

const generatedDir = resolve(process.cwd(), 'src/data/generated');

/** Countries knowingly absent from the bundled TopoJSON — kept in sync with the build. */
const KNOWN_NO_GEOMETRY = ['TV']; // Tuvalu

const EXPECTED_REGIONS = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];

describe('country dataset', () => {
  const countries = getCountries();

  it('covers the 195 UN members + observer states', () => {
    expect(countryCount()).toBe(195);
    expect(countries).toHaveLength(195);
    expect(meta.counts.countries).toBe(195);
  });

  it('gives every country a complete, non-empty record', () => {
    for (const c of countries) {
      expect(c.iso2, `iso2 for ${c.iso3}`).toMatch(/^[A-Z]{2}$/);
      expect(c.iso3, `iso3 for ${c.iso2}`).toMatch(/^[A-Z]{3}$/);
      expect(c.numericId, `numericId for ${c.iso2}`).toMatch(/^\d{3}$/);
      expect(c.name.en.length, `name.en for ${c.iso2}`).toBeGreaterThan(0);
      expect(c.name.fr.length, `name.fr for ${c.iso2}`).toBeGreaterThan(0);
      expect(EXPECTED_REGIONS).toContain(c.region);
      expect(c.subregion.length, `subregion for ${c.iso2}`).toBeGreaterThan(0);
      expect(c.flagAsset).toBe(`flags/${c.iso2.toLowerCase()}.svg`);
    }
  });

  it('has unique ISO codes and unique names in both languages', () => {
    const unique = (xs: string[]) => new Set(xs).size === xs.length;
    expect(unique(countries.map((c) => c.iso2))).toBe(true);
    expect(unique(countries.map((c) => c.iso3))).toBe(true);
    expect(unique(countries.map((c) => c.numericId))).toBe(true);
    expect(unique(countries.map((c) => c.name.en))).toBe(true);
    expect(unique(countries.map((c) => c.name.fr))).toBe(true);
  });

  it('resolves a bundled flag SVG for every country', () => {
    for (const c of countries) {
      expect(existsSync(resolve(generatedDir, c.flagAsset)), `flag file for ${c.iso2}`).toBe(true);
    }
  });

  it('resolves map geometry for every country except the known exceptions', () => {
    const missing = countries.filter((c) => !c.hasGeometry).map((c) => c.iso2);
    expect(missing.sort()).toEqual([...KNOWN_NO_GEOMETRY].sort());
    expect(meta.geometryExceptions.sort()).toEqual([...KNOWN_NO_GEOMETRY].sort());
  });

  it('sorts countries by English name', () => {
    const names = countries.map((c) => c.name.en);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });
});

describe('flagUrl', () => {
  it('resolves a URL from a country or an ISO code', () => {
    const bg = getCountry('BG')!;
    expect(flagUrl(bg)).toBeTruthy();
    expect(flagUrl('bg')).toBe(flagUrl(bg));
  });

  it('throws for an unknown country', () => {
    expect(() => flagUrl('ZZ')).toThrow();
  });
});

describe('getCountry', () => {
  it('looks up by alpha-2 and alpha-3, case-insensitively', () => {
    const byIso2 = getCountry('FR');
    expect(byIso2?.name.en).toBe('France');
    expect(getCountry('fr')).toBe(byIso2);
    expect(getCountry('FRA')).toBe(byIso2);
    expect(getCountry('fra')).toBe(byIso2);
  });

  it('returns undefined for an unknown code', () => {
    expect(getCountry('ZZ')).toBeUndefined();
    expect(getCountry('')).toBeUndefined();
  });
});

describe('region tree', () => {
  it('exposes the five UN M49 regions', () => {
    expect(getRegions().sort()).toEqual(EXPECTED_REGIONS);
  });

  it('returns the correct members for a sample region and sub-region', () => {
    const westernEurope = getCountriesBySubregion('Western Europe').map((c) => c.iso2);
    expect(westernEurope).toContain('FR');
    expect(westernEurope).toContain('DE');
    expect(westernEurope).not.toContain('IT'); // Southern Europe

    const europe = getCountriesByRegion('Europe').map((c) => c.iso2);
    expect(europe).toContain('FR');
    expect(europe).not.toContain('JP');

    expect(getSubregions('Europe')).toContain('Western Europe');
    expect(getSubregions('Oceania')).toEqual(['Oceania']); // single, unsubdivided bucket
  });

  it('partitions every country into exactly one region and sub-region', () => {
    const tree = getRegionTree();
    expect(tree.map((r) => r.region)).toEqual(EXPECTED_REGIONS);

    const seen = new Set<string>();
    let leafTotal = 0;
    for (const region of tree) {
      const fromSubs = region.subregions.flatMap((s) => s.countries);
      expect(fromSubs).toHaveLength(region.countries.length);
      for (const c of fromSubs) {
        expect(seen.has(c.iso2)).toBe(false); // no country appears twice
        seen.add(c.iso2);
        expect(c.region).toBe(region.region);
      }
      leafTotal += fromSubs.length;
    }
    expect(leafTotal).toBe(195);
    expect(seen.size).toBe(195);
  });

  it('sorts regions, sub-regions, and their countries alphabetically', () => {
    const tree = getRegionTree();
    for (const region of tree) {
      const subNames = region.subregions.map((s) => s.subregion);
      expect(subNames).toEqual([...subNames].sort((a, b) => a.localeCompare(b, 'en')));
      for (const sub of region.subregions) {
        const names = sub.countries.map((c) => c.name.en);
        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
      }
    }
  });
});

describe('play-region buckets (Phase 19)', () => {
  const MIN_POOL = 8; // kept in sync with scripts/build-data.mjs
  const countries = getCountries();

  // Buckets are unique across regions, so grouping by sub-region name alone is safe.
  const bySubregion = new Map<string, string[]>();
  for (const c of countries) {
    const list = bySubregion.get(c.subregion) ?? [];
    list.push(c.iso2);
    bySubregion.set(c.subregion, list);
  }

  it('groups every country into one of the 15 expected balanced buckets', () => {
    const EXPECTED_BUCKETS = [
      'Caribbean',
      'Central & Eastern Asia',
      'Eastern & Southern Africa',
      'Eastern Europe',
      'North & Central America',
      'Northern & Central Africa',
      'Northern Europe',
      'Oceania',
      'South America',
      'South-Eastern Asia',
      'Southern Asia',
      'Southern Europe',
      'Western Africa',
      'Western Asia',
      'Western Europe',
    ];
    expect([...bySubregion.keys()].sort((a, b) => a.localeCompare(b, 'en'))).toEqual(
      EXPECTED_BUCKETS,
    );
  });

  it('gives every selectable bucket at least MIN_POOL countries (no degenerate pools)', () => {
    for (const [bucket, isos] of bySubregion) {
      expect(isos.length, `bucket "${bucket}" size`).toBeGreaterThanOrEqual(MIN_POOL);
    }
  });

  it('reshuffles Europe into the classic UN M49 four', () => {
    const bucketOf = (iso: string) => getCountry(iso)!.subregion;
    expect(bucketOf('AT')).toBe('Western Europe'); // Austria (raw "Central Europe")
    expect(bucketOf('SI')).toBe('Southern Europe'); // Slovenia (raw "Central Europe")
    expect(bucketOf('BG')).toBe('Eastern Europe'); // Bulgaria (raw "Southeast Europe")
    expect(bucketOf('RO')).toBe('Eastern Europe'); // Romania (raw "Southeast Europe")
    expect(getSubregions('Europe').sort((a, b) => a.localeCompare(b, 'en'))).toEqual([
      'Eastern Europe',
      'Northern Europe',
      'Southern Europe',
      'Western Europe',
    ]);
  });

  it('keeps Oceania as a single, unsubdivided bucket', () => {
    expect(getSubregions('Oceania')).toEqual(['Oceania']);
    expect(bySubregion.get('Oceania')).toHaveLength(14);
  });
});
