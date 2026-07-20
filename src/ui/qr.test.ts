import { describe, it, expect } from 'vitest';
import { duelQrModules } from './qr';

describe('duelQrModules', () => {
  it('returns a square matrix of booleans', () => {
    const m = duelQrModules('https://example.com/#/duel?c=abc');
    expect(m.length).toBeGreaterThan(20);
    expect(m.every((row) => row.length === m.length)).toBe(true);
    expect(m.flat().every((v) => typeof v === 'boolean')).toBe(true);
  });

  it('is deterministic for the same text', () => {
    expect(duelQrModules('same-input')).toEqual(duelQrModules('same-input'));
  });

  it('grows (or holds) the module count as the payload gets longer', () => {
    const small = duelQrModules('x');
    const big = duelQrModules('x'.repeat(400));
    expect(big.length).toBeGreaterThanOrEqual(small.length);
  });

  it('draws the top-left finder pattern (a solid 7×7 corner block)', () => {
    const m = duelQrModules('https://example.com/#/duel?c=abc');
    // Finder pattern: dark border ring around a dark 3×3 core, with a light ring between.
    expect(m[0][0]).toBe(true);
    expect(m[0][6]).toBe(true);
    expect(m[6][0]).toBe(true);
    expect(m[1][1]).toBe(false); // the light ring
    expect(m[3][3]).toBe(true); // the dark core
  });
});
