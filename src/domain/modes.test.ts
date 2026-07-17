import { describe, it, expect } from 'vitest';
import { FAMILIES, masteryFamilyOf } from './modes';

describe('masteryFamilyOf', () => {
  it('maps each of a family’s two directions back to that family', () => {
    expect(masteryFamilyOf('map-highlight')).toBe('map');
    expect(masteryFamilyOf('map-locate')).toBe('map');
    expect(masteryFamilyOf('flag-to-country')).toBe('flags');
    expect(masteryFamilyOf('country-to-flag')).toBe('flags');
    expect(masteryFamilyOf('capital-to-country')).toBe('capitals');
    expect(masteryFamilyOf('country-to-capital')).toBe('capitals');
  });

  it('returns null for the extra-knowledge modes (not part of a core family)', () => {
    expect(masteryFamilyOf('country-to-languages')).toBeNull();
    expect(masteryFamilyOf('country-to-industry')).toBeNull();
  });

  it('is consistent with the FAMILIES registry for every family mode', () => {
    for (const f of FAMILIES) for (const m of f.modes) expect(masteryFamilyOf(m)).toBe(f.key);
  });
});
