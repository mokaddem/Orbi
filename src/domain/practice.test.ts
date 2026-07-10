import { describe, it, expect } from 'vitest';
import type { Country } from '../data/types';
import { MAX_QUIZ_LANGUAGES } from './questions';
import { addToPractice, practiceEligibility, removeFromPractice, togglePractice } from './practice';

/** Minimal synthetic country; `opts` override the attribute-bearing fields per test. */
function mk(
  iso2: string,
  opts: { hasGeometry?: boolean; langCount?: number; industryCount?: number } = {},
): Country {
  const langCount = opts.langCount ?? 1;
  const industryCount = opts.industryCount ?? 1;
  return {
    iso2,
    iso3: (iso2 + 'Z').toUpperCase(),
    numericId: '000',
    name: { en: iso2, fr: iso2, de: iso2 },
    capital: { en: `${iso2}-cap`, fr: `${iso2}-cap`, de: `${iso2}-cap` },
    languages: Array.from({ length: langCount }, (_, i) => ({
      code: `${iso2.toLowerCase()}${i}`,
      name: { en: `${iso2}${i}`, fr: `${iso2}${i}`, de: `${iso2}${i}` },
    })),
    industries: Array.from({ length: industryCount }, (_, i) => ({
      key: `ind-${iso2.toLowerCase()}${i}`,
      name: { en: `${iso2}${i}`, fr: `${iso2}${i}`, de: `${iso2}${i}` },
    })),
    region: 'R',
    subregion: 'S',
    flagAsset: `flags/${iso2.toLowerCase()}.svg`,
    hasGeometry: opts.hasGeometry ?? true,
  };
}

describe('togglePractice', () => {
  it('adds an absent code (appended, preserving order) and never mutates the input', () => {
    const set = ['AA', 'BB'];
    const next = togglePractice(set, 'CC');
    expect(next).toEqual(['AA', 'BB', 'CC']);
    expect(set).toEqual(['AA', 'BB']); // unchanged
  });

  it('removes a present code', () => {
    expect(togglePractice(['AA', 'BB', 'CC'], 'BB')).toEqual(['AA', 'CC']);
  });
});

describe('addToPractice', () => {
  it('merges, de-duplicates, and keeps existing members in place', () => {
    expect(addToPractice(['AA', 'BB'], ['BB', 'CC', 'AA', 'DD'])).toEqual(['AA', 'BB', 'CC', 'DD']);
  });

  it('is a no-op when every addition is already present', () => {
    expect(addToPractice(['AA', 'BB'], ['AA', 'BB'])).toEqual(['AA', 'BB']);
  });
});

describe('removeFromPractice', () => {
  it('drops every listed code and leaves the rest in order', () => {
    expect(removeFromPractice(['AA', 'BB', 'CC', 'DD'], ['BB', 'DD'])).toEqual(['AA', 'CC']);
  });
});

describe('practiceEligibility', () => {
  it('keeps every country for a plain option mode, preserving selection order', () => {
    const countries = [mk('CC'), mk('AA'), mk('BB')];
    const { eligible, skipped } = practiceEligibility('flag-to-country', countries);
    expect(eligible.map((c) => c.iso2)).toEqual(['CC', 'AA', 'BB']);
    expect(skipped).toEqual([]);
  });

  it('drops countries without map geometry in map modes', () => {
    const countries = [mk('AA'), mk('NG', { hasGeometry: false }), mk('BB')];
    const { eligible, skipped } = practiceEligibility('map-locate', countries);
    expect(eligible.map((c) => c.iso2)).toEqual(['AA', 'BB']);
    expect(skipped.map((c) => c.iso2)).toEqual(['NG']);
  });

  it('drops countries with no curated industries in the industries mode', () => {
    const countries = [mk('AA', { industryCount: 2 }), mk('NX', { industryCount: 0 })];
    const { eligible, skipped } = practiceEligibility('country-to-industry', countries);
    expect(eligible.map((c) => c.iso2)).toEqual(['AA']);
    expect(skipped.map((c) => c.iso2)).toEqual(['NX']);
  });

  it('drops countries with too many languages to "select all" about', () => {
    const countries = [mk('AA', { langCount: 2 }), mk('BX', { langCount: MAX_QUIZ_LANGUAGES + 1 })];
    const { eligible, skipped } = practiceEligibility('country-to-languages', countries);
    expect(eligible.map((c) => c.iso2)).toEqual(['AA']);
    expect(skipped.map((c) => c.iso2)).toEqual(['BX']);
  });
});
