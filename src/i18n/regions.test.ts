import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { REGION_NAMES_BY_LOCALE, regionName } from './regions';
import { localizedRegion, setLocale } from './index';
import { getRegionTree } from '../data';

describe('regionName', () => {
  it('returns English M49 labels unchanged', () => {
    expect(regionName('Europe', 'en')).toBe('Europe');
    expect(regionName('Eastern Europe', 'en')).toBe('Eastern Europe');
  });

  it('translates known regions and sub-regions to French', () => {
    expect(regionName('Africa', 'fr')).toBe('Afrique');
    expect(regionName('Northern Africa', 'fr')).toBe('Afrique du Nord');
    expect(regionName('South-Eastern Asia', 'fr')).toBe('Asie du Sud-Est');
  });

  it('translates known regions and sub-regions to German', () => {
    expect(regionName('Africa', 'de')).toBe('Afrika');
    expect(regionName('Northern Africa', 'de')).toBe('Nordafrika');
    expect(regionName('South-Eastern Asia', 'de')).toBe('Südostasien');
    // The "Southern Africa" region stays distinct from "Südafrika" (the country).
    expect(regionName('Southern Africa', 'de')).toBe('Südliches Afrika');
  });

  it('falls back to the raw label for an unknown name', () => {
    expect(regionName('Atlantis', 'fr')).toBe('Atlantis');
    expect(regionName('Atlantis', 'de')).toBe('Atlantis');
  });

  it('covers every region and sub-region in the bundled dataset, in every locale', () => {
    for (const [locale, map] of Object.entries(REGION_NAMES_BY_LOCALE)) {
      for (const node of getRegionTree()) {
        expect(map[node.region], `missing ${locale} for region "${node.region}"`).toBeTruthy();
        for (const sub of node.subregions) {
          expect(
            map[sub.subregion],
            `missing ${locale} for sub-region "${sub.subregion}"`,
          ).toBeTruthy();
        }
      }
    }
  });
});

describe('localizedRegion store', () => {
  it('tracks the active locale', () => {
    setLocale('en');
    expect(get(localizedRegion)('Asia')).toBe('Asia');
    setLocale('fr');
    expect(get(localizedRegion)('Asia')).toBe('Asie');
    setLocale('de');
    expect(get(localizedRegion)('Asia')).toBe('Asien');
    setLocale('en'); // restore for other suites
  });
});
