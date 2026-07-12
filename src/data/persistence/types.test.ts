import { describe, it, expect } from 'vitest';
import { DEFAULT_PREFS, MAP_PROJECTIONS, clampPrefs, isMapProjection, type Prefs } from './types';

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
