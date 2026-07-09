import { describe, it, expect } from 'vitest';
import type { Country } from '../data/types';
import { getCountries } from '../data';
import { mulberry32 } from './rng';
import {
  DEFAULT_CHOICES,
  buildQuestion,
  checkAnswer,
  drawAnswerSequence,
  eligibleAnswers,
  filterCountries,
  generateQuestions,
  hasOptions,
  isMapMode,
  itemKey,
  selectDistractors,
} from './questions';
import type { GameMode } from './types';

/** A minimal synthetic country for deterministic, dataset-independent assertions. */
function mk(iso2: string, region: string, subregion: string): Country {
  return {
    iso2,
    iso3: (iso2 + 'Z').toUpperCase(),
    numericId: '000',
    name: { en: iso2, fr: iso2, de: iso2 },
    capital: { en: `${iso2}-cap`, fr: `${iso2}-cap`, de: `${iso2}-cap` },
    region,
    subregion,
    flagAsset: `flags/${iso2.toLowerCase()}.svg`,
    hasGeometry: true,
  };
}

// R1 has two sub-regions (S1: 4, S2: 2); R2 has one (S3: 3). Total 9.
const UNIVERSE: Country[] = [
  mk('AA', 'R1', 'S1'),
  mk('AB', 'R1', 'S1'),
  mk('AC', 'R1', 'S1'),
  mk('AD', 'R1', 'S1'),
  mk('BA', 'R1', 'S2'),
  mk('BB', 'R1', 'S2'),
  mk('CA', 'R2', 'S3'),
  mk('CB', 'R2', 'S3'),
  mk('CC', 'R2', 'S3'),
];

const iso = (cs: Country[]) => cs.map((c) => c.iso2).sort();
const byIso2 = (i: string) => UNIVERSE.find((c) => c.iso2 === i)!;

// Country-option modes: the answer and options are all countries (capital-to-country is
// one too — only its prompt is a capital string, the options stay country names).
const OPTION_MODES: GameMode[] = [
  'flag-to-country',
  'country-to-flag',
  'map-highlight',
  'capital-to-country',
];

describe('itemKey / hasOptions', () => {
  it('builds a stable per-item key', () => {
    expect(itemKey('flag-to-country', 'FR')).toBe('flag-to-country:FR');
  });

  it('marks map-locate as the only mode without options', () => {
    expect(hasOptions('map-locate')).toBe(false);
    for (const m of OPTION_MODES) expect(hasOptions(m)).toBe(true);
  });

  it('identifies the two map modes', () => {
    expect(isMapMode('map-highlight')).toBe(true);
    expect(isMapMode('map-locate')).toBe(true);
    expect(isMapMode('flag-to-country')).toBe(false);
    expect(isMapMode('country-to-flag')).toBe(false);
  });
});

describe('filterCountries', () => {
  it('returns a copy of all countries when no filter is active', () => {
    expect(filterCountries(UNIVERSE)).toHaveLength(UNIVERSE.length);
    expect(filterCountries(UNIVERSE, {})).toHaveLength(UNIVERSE.length);
    expect(filterCountries(UNIVERSE)).not.toBe(UNIVERSE); // fresh array
  });

  it('filters by region and by sub-region', () => {
    expect(iso(filterCountries(UNIVERSE, { region: 'R1' }))).toEqual([
      'AA',
      'AB',
      'AC',
      'AD',
      'BA',
      'BB',
    ]);
    expect(iso(filterCountries(UNIVERSE, { subregion: 'S2' }))).toEqual(['BA', 'BB']);
    expect(iso(filterCountries(UNIVERSE, { region: 'R1', subregion: 'S3' }))).toEqual([]);
  });
});

describe('eligibleAnswers', () => {
  // A pool where one member (XX) has no map geometry, like Tuvalu in the real dataset.
  const geoMixed: Country[] = [
    mk('AA', 'R1', 'S1'),
    mk('AB', 'R1', 'S1'),
    { ...mk('XX', 'R1', 'S1'), hasGeometry: false },
  ];

  it('keeps every country for option-based flag modes', () => {
    for (const mode of ['flag-to-country', 'country-to-flag'] as GameMode[]) {
      expect(iso(eligibleAnswers(mode, geoMixed))).toEqual(['AA', 'AB', 'XX']);
    }
  });

  it('drops geometry-less countries for both map modes', () => {
    for (const mode of ['map-highlight', 'map-locate'] as GameMode[]) {
      expect(iso(eligibleAnswers(mode, geoMixed))).toEqual(['AA', 'AB']);
    }
  });

  it('returns a fresh array (never the input)', () => {
    expect(eligibleAnswers('flag-to-country', geoMixed)).not.toBe(geoMixed);
  });

  it('never asks about a geometry-less country in map modes via generateQuestions', () => {
    for (const mode of ['map-highlight', 'map-locate'] as GameMode[]) {
      const qs = generateQuestions({ mode, countries: geoMixed, count: 30, rng: mulberry32(7) });
      expect(qs.map((q) => q.answer.iso2)).not.toContain('XX');
    }
    // …but flag modes still can (geometry is irrelevant there).
    const flagQs = generateQuestions({
      mode: 'flag-to-country',
      countries: geoMixed,
      count: 30,
      rng: mulberry32(7),
    });
    expect(flagQs.map((q) => q.answer.iso2)).toContain('XX');
  });
});

describe('selectDistractors', () => {
  it('draws entirely from the same sub-region when it has enough', () => {
    const d = selectDistractors(byIso2('AA'), UNIVERSE, 3, mulberry32(1));
    expect(iso(d)).toEqual(['AB', 'AC', 'AD']); // the other three of S1
  });

  it('never includes the answer and never duplicates', () => {
    for (let seed = 0; seed < 20; seed++) {
      const d = selectDistractors(byIso2('AA'), UNIVERSE, 3, mulberry32(seed));
      expect(d.map((c) => c.iso2)).not.toContain('AA');
      expect(new Set(d.map((c) => c.iso2)).size).toBe(d.length);
    }
  });

  it('falls back to the wider region before the rest of the world', () => {
    // BA's sub-region S2 has only one other member (BB); the region tier (R1) fills the rest.
    const d = selectDistractors(byIso2('BA'), UNIVERSE, 3, mulberry32(4));
    expect(d.map((c) => c.iso2)).toContain('BB');
    expect(d.every((c) => c.region === 'R1')).toBe(true); // never reached R2
    expect(d).toHaveLength(3);
  });

  it('falls back to the rest of the world only when region cannot fill', () => {
    // BA: S2 gives 1 (BB), R1-not-S2 gives 4, so a 6th distractor must come from R2.
    const d = selectDistractors(byIso2('BA'), UNIVERSE, 6, mulberry32(4));
    expect(d).toHaveLength(6);
    expect(d.some((c) => c.region === 'R2')).toBe(true);
  });

  it('returns fewer than requested when the universe is too small', () => {
    const tiny = [mk('AA', 'R1', 'S1'), mk('AB', 'R1', 'S1')];
    const d = selectDistractors(tiny[0], tiny, 3, mulberry32(1));
    expect(iso(d)).toEqual(['AB']);
  });
});

describe('buildQuestion', () => {
  it('includes the answer among exactly `choices` unique options', () => {
    for (const mode of OPTION_MODES) {
      const q = buildQuestion(mode, byIso2('AA'), UNIVERSE, DEFAULT_CHOICES, mulberry32(5));
      expect(q.mode).toBe(mode);
      expect(q.itemKey).toBe(`${mode}:AA`);
      expect(q.options).toHaveLength(DEFAULT_CHOICES);
      expect(q.options!.map((c) => c.iso2)).toContain('AA');
      expect(new Set(q.options!.map((c) => c.iso2)).size).toBe(DEFAULT_CHOICES);
    }
  });

  it('gives map-locate no options', () => {
    const q = buildQuestion('map-locate', byIso2('AA'), UNIVERSE, DEFAULT_CHOICES, mulberry32(5));
    expect(q.options).toBeUndefined();
    expect(q.itemKey).toBe('map-locate:AA');
    expect(q.answer.iso2).toBe('AA');
  });

  it('shrinks the option count when the universe is too small', () => {
    const tiny = [mk('AA', 'R1', 'S1'), mk('AB', 'R1', 'S1')];
    const q = buildQuestion('flag-to-country', tiny[0], tiny, 4, mulberry32(1));
    expect(q.options).toHaveLength(2); // answer + the one available distractor
  });
});

describe('buildQuestion — attribute modes (country-to-capital)', () => {
  it('builds attributeOptions (capitals) keyed by owning ISO2, with the answer correct', () => {
    const answer = byIso2('AA');
    const q = buildQuestion('country-to-capital', answer, UNIVERSE, DEFAULT_CHOICES, mulberry32(5));

    expect(q.itemKey).toBe('country-to-capital:AA'); // keyed per-country like every mode
    expect(q.options).toBeUndefined(); // no country options
    expect(q.attributeOptions).toHaveLength(DEFAULT_CHOICES);
    // The correct option is the answer country's ISO2, and its label is the answer's capital.
    expect(q.correctOptionId).toBe('AA');
    const correct = q.attributeOptions!.find((o) => o.id === q.correctOptionId);
    expect(correct!.label).toEqual(answer.capital);
    // Every option label is some in-universe country's capital, and ids/labels are unique.
    const ids = q.attributeOptions!.map((o) => o.id);
    expect(ids).toContain('AA');
    expect(new Set(ids).size).toBe(DEFAULT_CHOICES);
    expect(new Set(q.attributeOptions!.map((o) => o.label.en)).size).toBe(DEFAULT_CHOICES);
  });

  it('grades an attribute pick by option id, not by country ISO', () => {
    const q = buildQuestion('country-to-capital', byIso2('AA'), UNIVERSE, 4, mulberry32(1));
    expect(checkAnswer(q, q.correctOptionId!)).toBe(true);
    const wrong = q.attributeOptions!.find((o) => o.id !== q.correctOptionId)!;
    expect(checkAnswer(q, wrong.id)).toBe(false);
    expect(checkAnswer(q, null)).toBe(false);
    expect(checkAnswer(q, undefined)).toBe(false);
  });
});

describe('drawAnswerSequence', () => {
  it('produces the requested count', () => {
    expect(drawAnswerSequence(UNIVERSE, 25, mulberry32(1))).toHaveLength(25);
  });

  it('never repeats a country back-to-back when the pool has more than one', () => {
    const seq = drawAnswerSequence(UNIVERSE, 50, mulberry32(8));
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i].iso2).not.toBe(seq[i - 1].iso2);
    }
  });

  it('cycles through the whole pool before repeating', () => {
    const seq = drawAnswerSequence(UNIVERSE, UNIVERSE.length, mulberry32(2));
    expect(iso(seq)).toEqual(iso(UNIVERSE)); // one full permutation
  });

  it('handles a single-country pool (repeats are unavoidable) and empty inputs', () => {
    const one = [mk('AA', 'R1', 'S1')];
    expect(drawAnswerSequence(one, 3, mulberry32(1)).map((c) => c.iso2)).toEqual([
      'AA',
      'AA',
      'AA',
    ]);
    expect(drawAnswerSequence([], 3, mulberry32(1))).toEqual([]);
    expect(drawAnswerSequence(UNIVERSE, 0, mulberry32(1))).toEqual([]);
  });
});

describe('generateQuestions', () => {
  it('asks only about countries within the region filter', () => {
    const qs = generateQuestions({
      mode: 'flag-to-country',
      countries: UNIVERSE,
      count: 20,
      filter: { region: 'R1' },
      rng: mulberry32(3),
    });
    expect(qs).toHaveLength(20);
    for (const q of qs) expect(q.answer.region).toBe('R1');
  });

  it('keeps all options inside the region when filtered by region', () => {
    const qs = generateQuestions({
      mode: 'flag-to-country',
      countries: UNIVERSE,
      count: 20,
      filter: { region: 'R1' },
      rng: mulberry32(6),
    });
    // R1 has 6 countries, so 3 distractors always come from R1 — no spill to R2.
    for (const q of qs) {
      for (const opt of q.options!) expect(opt.region).toBe('R1');
    }
  });

  it('honors a sub-region filter for answers even if options must spill outward', () => {
    const qs = generateQuestions({
      mode: 'flag-to-country',
      countries: UNIVERSE,
      count: 10,
      filter: { subregion: 'S2' }, // only BA, BB
      rng: mulberry32(1),
    });
    for (const q of qs) expect(['BA', 'BB']).toContain(q.answer.iso2);
    // S2 has just 2 members, so options must borrow from the wider region.
    const spilled = qs.some((q) => q.options!.some((o) => o.subregion !== 'S2'));
    expect(spilled).toBe(true);
  });
});

describe('checkAnswer', () => {
  const q = buildQuestion('flag-to-country', byIso2('AA'), UNIVERSE, 4, mulberry32(1));

  it('accepts the answer as a Country, alpha-2, or alpha-3 (case-insensitive)', () => {
    expect(checkAnswer(q, byIso2('AA'))).toBe(true);
    expect(checkAnswer(q, 'AA')).toBe(true);
    expect(checkAnswer(q, 'aa')).toBe(true);
    expect(checkAnswer(q, 'AAZ')).toBe(true); // its iso3
    expect(checkAnswer(q, 'aaz')).toBe(true);
  });

  it('rejects a wrong pick or no answer', () => {
    expect(checkAnswer(q, byIso2('AB'))).toBe(false);
    expect(checkAnswer(q, 'AB')).toBe(false);
    expect(checkAnswer(q, null)).toBe(false);
    expect(checkAnswer(q, undefined)).toBe(false);
  });
});

// A light integration check against the real bundled dataset for every mode.
describe('generateQuestions (real dataset)', () => {
  const countries = getCountries();

  it('keeps every European question and its options within Europe', () => {
    for (const mode of ['flag-to-country', 'country-to-flag', 'map-highlight'] as GameMode[]) {
      const qs = generateQuestions({
        mode,
        countries,
        count: 60,
        filter: { region: 'Europe' },
        rng: mulberry32(99),
      });
      for (const q of qs) {
        expect(q.answer.region).toBe('Europe');
        expect(q.options).toHaveLength(DEFAULT_CHOICES);
        expect(new Set(q.options!.map((c) => c.iso2)).size).toBe(DEFAULT_CHOICES);
        for (const opt of q.options!) expect(opt.region).toBe('Europe');
      }
    }
  });

  it('produces optionless map-locate questions honoring the filter', () => {
    const qs = generateQuestions({
      mode: 'map-locate',
      countries,
      count: 30,
      filter: { region: 'Africa' },
      rng: mulberry32(1),
    });
    for (const q of qs) {
      expect(q.options).toBeUndefined();
      expect(q.answer.region).toBe('Africa');
    }
  });

  it('never poses a geometry-less country (Tuvalu) as a map answer, yet keeps it in flag modes', () => {
    const noGeometry = countries.filter((c) => !c.hasGeometry).map((c) => c.iso2);
    expect(noGeometry.length).toBeGreaterThan(0); // guards the test if the dataset changes

    // Across many draws over the whole world, no map question should ask about one.
    for (const mode of ['map-highlight', 'map-locate'] as GameMode[]) {
      const qs = generateQuestions({ mode, countries, count: 600, rng: mulberry32(42) });
      for (const q of qs) expect(noGeometry).not.toContain(q.answer.iso2);
    }
    // Flag modes are unaffected — every country, geometry or not, can be asked.
    const flagAnswers = new Set(
      generateQuestions({
        mode: 'flag-to-country',
        countries,
        count: 4000,
        rng: mulberry32(42),
      }).map((q) => q.answer.iso2),
    );
    for (const iso of noGeometry) expect(flagAnswers).toContain(iso);
  });
});
