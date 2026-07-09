import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { REGION_NAMES_BY_LOCALE, regionName } from './regions';
import { localizedRegion, setLocale } from './index';
import { getRegionTree } from '../data';

describe('regionName', () => {
  it('returns English labels unchanged', () => {
    expect(regionName('Europe', 'en')).toBe('Europe');
    expect(regionName('Eastern & Southern Africa', 'en')).toBe('Eastern & Southern Africa');
  });

  it('translates known regions and sub-regions to French', () => {
    expect(regionName('Africa', 'fr')).toBe('Afrique');
    expect(regionName('Northern & Central Africa', 'fr')).toBe('Afrique du Nord et centrale');
    expect(regionName('South-Eastern Asia', 'fr')).toBe('Asie du Sud-Est');
  });

  it('translates known regions and sub-regions to German', () => {
    expect(regionName('Africa', 'de')).toBe('Afrika');
    expect(regionName('Northern & Central Africa', 'de')).toBe('Nord- und Zentralafrika');
    expect(regionName('South-Eastern Asia', 'de')).toBe('Südostasien');
    // "südliches" stays lowercase so the region reads distinct from "Südafrika" (the country).
    expect(regionName('Eastern & Southern Africa', 'de')).toBe('Ost- und südliches Afrika');
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
