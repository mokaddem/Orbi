/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getCountries,
  countryCount,
  getCountry,
  flagUrl,
  preloadFlags,
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

describe('industries dataset (Phase 25)', () => {
  const countries = getCountries();

  it('every country has ≥1 industry or is a documented exception, and the split is exhaustive', () => {
    const exceptions = new Set<string>(meta.industryExceptions);
    for (const c of countries) {
      if (c.industries.length === 0) {
        expect(exceptions.has(c.iso2), `${c.iso2} has no industries but isn't in exceptions`).toBe(
          true,
        );
      } else {
        expect(exceptions.has(c.iso2), `${c.iso2} is covered but also listed as an exception`).toBe(
          false,
        );
      }
    }
    const covered = countries.filter((c) => c.industries.length > 0).length;
    expect(covered).toBe(meta.counts.withIndustries);
    expect(covered + meta.industryExceptions.length).toBe(195);
  });

  it('gives every industry a kebab-case key and a complete localized name, unique per country', () => {
    for (const c of countries) {
      const keys = c.industries.map((i) => i.key);
      expect(new Set(keys).size, `duplicate industry key in ${c.iso2}`).toBe(keys.length);
      for (const ind of c.industries) {
        expect(ind.key, `key shape for ${c.iso2}`).toMatch(/^[a-z][a-z-]*[a-z]$/);
        expect(ind.name.en.length, `en name for ${c.iso2}:${ind.key}`).toBeGreaterThan(0);
        expect(ind.name.fr.length, `fr name for ${c.iso2}:${ind.key}`).toBeGreaterThan(0);
        expect(ind.name.de.length, `de name for ${c.iso2}:${ind.key}`).toBeGreaterThan(0);
      }
    }
  });

  it('uses a 20-category taxonomy over a quiz-sized pool of well-known economies', () => {
    expect(meta.counts.industryTaxonomy).toBe(20);
    // Guard against an accidentally-narrow dataset: the pool must stay large enough for a real
    // quiz (owner chose "well-known economies", which landed at ~140). Exact number may shift.
    expect(meta.counts.withIndustries).toBeGreaterThanOrEqual(100);
  });
});

describe('industry "why" facts (Phase 32)', () => {
  const countries = getCountries();
  const withFact = countries.flatMap((c) =>
    c.industries.filter((i) => i.fact).map((i) => ({ iso2: c.iso2, ind: i })),
  );

  it('ships a fact only attached to a real industry the country carries, fully trilingual', () => {
    for (const { iso2, ind } of withFact) {
      // A fact is only ever attached to an industry the country actually has (so the quiz can
      // surface it), and must be complete in all three UI languages (parity is a hard rule).
      expect(ind.fact!.en.trim().length, `en fact for ${iso2}:${ind.key}`).toBeGreaterThan(0);
      expect(ind.fact!.fr.trim().length, `fr fact for ${iso2}:${ind.key}`).toBeGreaterThan(0);
      expect(ind.fact!.de.trim().length, `de fact for ${iso2}:${ind.key}`).toBeGreaterThan(0);
    }
  });

  it('matches the coverage recorded in meta (pilot: full facts for the priority countries)', () => {
    const factCountries = new Set(withFact.map((f) => f.iso2));
    expect(withFact.length).toBe(meta.counts.industryFactPairs);
    expect(factCountries.size).toBe(meta.counts.withIndustryFacts);
    // A covered country has a fact for *every* industry it carries (Option A), so no covered
    // country is left half-annotated.
    for (const iso2 of factCountries) {
      const c = countries.find((x) => x.iso2 === iso2)!;
      expect(
        c.industries.every((i) => i.fact),
        `${iso2} is fact-covered but some industries lack a fact`,
      ).toBe(true);
    }
  });

  it('leaves the long tail uncovered (facts are a subset by design, degrading gracefully)', () => {
    // Sanity: the pilot covers a real subset — some industries-bearing countries carry no fact,
    // which the reveal simply omits. Guards against an accidental "all or nothing" regression.
    const industryCountries = countries.filter((c) => c.industries.length > 0);
    const uncovered = industryCountries.filter((c) => c.industries.every((i) => !i.fact));
    expect(uncovered.length).toBeGreaterThan(0);
    expect(meta.counts.withIndustryFacts).toBeGreaterThanOrEqual(40);
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

describe('preloadFlags', () => {
  it('warms each valid flag once and skips unknowns, without throwing', () => {
    const created: string[] = [];
    const RealImage = globalThis.Image;
    // Capture the src set on each off-screen Image so we can assert what got warmed + deduped.
    class FakeImage {
      decoding = '';
      #src = '';
      set src(v: string) {
        this.#src = v;
        created.push(v);
      }
      get src(): string {
        return this.#src;
      }
    }
    globalThis.Image = FakeImage as unknown as typeof Image;
    try {
      preloadFlags(['FR', getCountry('DE')!, 'ZZ']); // FR + DE warm; ZZ ignored
      expect(created).toContain(flagUrl('FR'));
      expect(created).toContain(flagUrl('DE'));
      expect(created).not.toContain(undefined);
      const after = created.length;
      preloadFlags(['FR', 'DE']); // already warmed → no new loads
      expect(created.length).toBe(after);
    } finally {
      globalThis.Image = RealImage;
    }
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
