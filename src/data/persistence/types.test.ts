import { describe, it, expect } from 'vitest';
import { DEFAULT_PREFS, MAP_PROJECTIONS, clampPrefs, isMapProjection, type Prefs } from './types';

const base: Prefs = {
  language: 'en',
  survivalLives: 3,
  fixedLength: 10,
  choicesPerQuestion: 4,
  mapProjection: 'naturalEarth',
  reduceMotion: false,
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
  });

  it('coerces a corrupted/legacy projection back to the default', () => {
    // A pre-Phase-28 prefs blob has no mapProjection; a corrupted one has a bad value.
    expect(
      clampPrefs({ ...base, mapProjection: 'globe' as Prefs['mapProjection'] }).mapProjection,
    ).toBe('naturalEarth');
    expect(
      clampPrefs({ ...base, mapProjection: undefined as unknown as Prefs['mapProjection'] })
        .mapProjection,
    ).toBe('naturalEarth');
  });
});
