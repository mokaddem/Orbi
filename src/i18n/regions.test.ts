import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { REGION_NAMES_FR, regionName } from './regions';
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

  it('falls back to the raw label for an unknown name', () => {
    expect(regionName('Atlantis', 'fr')).toBe('Atlantis');
  });

  it('covers every region and sub-region in the bundled dataset', () => {
    for (const node of getRegionTree()) {
      expect(REGION_NAMES_FR[node.region], `missing FR for region "${node.region}"`).toBeTruthy();
      for (const sub of node.subregions) {
        expect(
          REGION_NAMES_FR[sub.subregion],
          `missing FR for sub-region "${sub.subregion}"`,
        ).toBeTruthy();
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
    setLocale('en'); // restore for other suites
  });
});
