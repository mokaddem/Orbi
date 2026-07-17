import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PREFS,
  MAP_PROJECTIONS,
  PREFS_BOUNDS,
  clampPrefs,
  isMapProjection,
  type Prefs,
} from './types';

const base: Prefs = {
  language: 'en',
  survivalLives: 3,
  fixedLength: 10,
  choicesPerQuestion: 4,
  mapProjection: 'naturalEarth',
  reduceMotion: false,
  sound: true,
};

describe('mapProjection pref (Phase 28)', () => {
  it('defaults to naturalEarth', () => {
    expect(DEFAULT_PREFS.mapProjection).toBe('naturalEarth');
  });

  it('recognises every offered projection and rejects anything else', () => {
    for (const name of MAP_PROJECTIONS) expect(isMapProjection(name)).toBe(true);
    for (const bad of ['orthographic', '', 'NaturalEarth', undefined, null, 3]) {
      expect(isMapProjection(bad)).toBe(false);
    }
  });

  it('keeps a valid stored projection through clampPrefs', () => {
    expect(clampPrefs({ ...base, mapProjection: 'mercator' }).mapProjection).toBe('mercator');
    // 'globe' (Phase 38) is a valid surface too, not coerced away.
    expect(clampPrefs({ ...base, mapProjection: 'globe' }).mapProjection).toBe('globe');
  });

  it('coerces a corrupted/legacy projection back to the default', () => {
    // A pre-Phase-28 prefs blob has no mapProjection; a corrupted one has a bad value.
    expect(
      clampPrefs({ ...base, mapProjection: 'orthographic' as Prefs['mapProjection'] })
        .mapProjection,
    ).toBe('naturalEarth');
    expect(
      clampPrefs({ ...base, mapProjection: undefined as unknown as Prefs['mapProjection'] })
        .mapProjection,
    ).toBe('naturalEarth');
  });
});

describe('numeric prefs bounds', () => {
  it('caps survival lives to 3–10', () => {
    expect(PREFS_BOUNDS.survivalLives).toEqual({ min: 3, max: 10 });
    expect(clampPrefs({ ...base, survivalLives: 1 }).survivalLives).toBe(3);
    expect(clampPrefs({ ...base, survivalLives: 12 }).survivalLives).toBe(10);
    expect(clampPrefs({ ...base, survivalLives: 7 }).survivalLives).toBe(7);
  });

  it('caps answer choices per question to 4–8', () => {
    expect(PREFS_BOUNDS.choicesPerQuestion).toEqual({ min: 4, max: 8 });
    expect(clampPrefs({ ...base, choicesPerQuestion: 2 }).choicesPerQuestion).toBe(4);
    expect(clampPrefs({ ...base, choicesPerQuestion: 10 }).choicesPerQuestion).toBe(8);
    expect(clampPrefs({ ...base, choicesPerQuestion: 6 }).choicesPerQuestion).toBe(6);
  });

  it('keeps both defaults inside their new bounds', () => {
    expect(clampPrefs({ ...DEFAULT_PREFS }).survivalLives).toBe(DEFAULT_PREFS.survivalLives);
    expect(clampPrefs({ ...DEFAULT_PREFS }).choicesPerQuestion).toBe(
      DEFAULT_PREFS.choicesPerQuestion,
    );
  });
});

describe('sound pref (Phase 36)', () => {
  it('defaults to on', () => {
    expect(DEFAULT_PREFS.sound).toBe(true);
  });

  it('keeps an explicit boolean through clampPrefs', () => {
    expect(clampPrefs({ ...base, sound: false }).sound).toBe(false);
    expect(clampPrefs({ ...base, sound: true }).sound).toBe(true);
  });

  it('defaults an absent (pre-Phase-36) value to on rather than off', () => {
    // A legacy prefs blob has no `sound` key; the default is *on*, so a plain `!!` coercion
    // (which would yield off) would be wrong — an absent value must resolve to the default.
    expect(clampPrefs({ ...base, sound: undefined as unknown as Prefs['sound'] }).sound).toBe(true);
  });
});

describe('lastSetup pref (remember Play setup)', () => {
  it('is absent by default', () => {
    expect(clampPrefs({ ...base }).lastSetup).toBeUndefined();
  });

  it('round-trips a well-formed setup (incl. region / sub-region)', () => {
    const lastSetup: Prefs['lastSetup'] = {
      mode: 'capital-to-country',
      type: 'blitz',
      region: 'Europe',
      subregion: 'Northern Europe',
    };
    expect(clampPrefs({ ...base, lastSetup }).lastSetup).toEqual(lastSetup);
  });

  it('keeps a World-scope setup with no region fields', () => {
    const lastSetup: Prefs['lastSetup'] = { mode: 'flag-to-country', type: 'fixed' };
    expect(clampPrefs({ ...base, lastSetup }).lastSetup).toEqual(lastSetup);
  });

  it('drops a structurally-broken value (missing mode/type)', () => {
    const broken = { region: 'Europe' } as unknown as Prefs['lastSetup'];
    expect(clampPrefs({ ...base, lastSetup: broken }).lastSetup).toBeUndefined();
  });
});
