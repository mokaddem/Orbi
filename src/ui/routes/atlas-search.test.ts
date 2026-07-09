import { describe, it, expect } from 'vitest';
import type { Country } from '../../data';
import {
  normalizeForSearch,
  countryMatches,
  searchCountries,
  groupByInitial,
} from './atlas-search';

function country(iso2: string, en: string, fr: string, de: string, region = 'Europe'): Country {
  return {
    iso2,
    iso3: iso2 + 'X',
    numericId: '0',
    name: { en, fr, de },
    capital: { en: `${en} City`, fr: `${en} City`, de: `${en} City` },
    region,
    subregion: region,
    flagAsset: `flags/${iso2.toLowerCase()}.svg`,
    hasGeometry: true,
  };
}

const FR = country('FR', 'France', 'France', 'Frankreich');
const DE = country('DE', 'Germany', 'Allemagne', 'Deutschland');
const CI = country('CI', "Côte d'Ivoire", "Côte d'Ivoire", 'Elfenbeinküste', 'Africa');
const AR = country('AR', 'Argentina', 'Argentine', 'Argentinien', 'Americas');

const ALL = [FR, DE, CI, AR];

describe('normalizeForSearch', () => {
  it('folds case and diacritics', () => {
    expect(normalizeForSearch('Côte')).toBe('cote');
    expect(normalizeForSearch('  ÅLAND ')).toBe('aland');
  });
});

describe('countryMatches', () => {
  it('matches across EN/FR/DE names', () => {
    expect(countryMatches(DE, normalizeForSearch('deutsch'))).toBe(true); // DE name
    expect(countryMatches(DE, normalizeForSearch('allemagne'))).toBe(true); // FR name
    expect(countryMatches(DE, normalizeForSearch('germany'))).toBe(true); // EN name
  });

  it('is diacritic-insensitive', () => {
    expect(countryMatches(CI, normalizeForSearch('cote'))).toBe(true);
  });

  it('an empty query matches everything', () => {
    expect(countryMatches(FR, '')).toBe(true);
  });
});

describe('searchCountries', () => {
  it('returns all (a copy) for an empty query', () => {
    const result = searchCountries(ALL, '   ');
    expect(result).toHaveLength(ALL.length);
    expect(result).not.toBe(ALL);
  });

  it('filters by substring across languages', () => {
    expect(searchCountries(ALL, 'arg').map((c) => c.iso2)).toEqual(['AR']);
    // "fran" hits France via both its EN ("France") and DE ("Frankreich") names.
    expect(searchCountries(ALL, 'fran').map((c) => c.iso2)).toEqual(['FR']);
    // A non-English name still finds its country: DE ("Allemagne" / "Deutschland").
    expect(searchCountries(ALL, 'deutsch').map((c) => c.iso2)).toEqual(['DE']);
  });

  it('returns nothing when no name matches', () => {
    expect(searchCountries(ALL, 'zzzz')).toEqual([]);
  });
});

describe('groupByInitial', () => {
  it('buckets by folded initial and sorts letters then names', () => {
    const groups = groupByInitial(ALL, (c) => c.name.en);
    expect(groups.map((g) => g.letter)).toEqual(['A', 'C', 'F', 'G']);
    const a = groups.find((g) => g.letter === 'A')!;
    expect(a.countries.map((c) => c.iso2)).toEqual(['AR']);
  });

  it('files accented initials under their base letter', () => {
    const groups = groupByInitial([CI], (c) => c.name.fr); // "Côte d'Ivoire"
    expect(groups[0].letter).toBe('C');
  });

  it('tracks the supplied (localized) name for both bucket and order', () => {
    // In German, Germany is "Deutschland" → files under D, not G.
    const groups = groupByInitial([DE], (c) => c.name.de);
    expect(groups[0].letter).toBe('D');
  });
});
