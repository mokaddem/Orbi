import { describe, it, expect } from 'vitest';
import { mulberry32, randomInt, shuffle, sample } from './rng';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different streams for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('returns floats in [0, 1)', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('randomInt', () => {
  it('stays within [0, n)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = randomInt(rng, 6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('returns 0 for non-positive n', () => {
    const rng = mulberry32(7);
    expect(randomInt(rng, 0)).toBe(0);
    expect(randomInt(rng, -3)).toBe(0);
  });
});

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, mulberry32(9));
    expect(input).toEqual([1, 2, 3, 4, 5]); // untouched
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it('is deterministic for a given seed', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(shuffle(input, mulberry32(3))).toEqual(shuffle(input, mulberry32(3)));
  });

  it('handles empty and single-element arrays', () => {
    expect(shuffle([], mulberry32(1))).toEqual([]);
    expect(shuffle([42], mulberry32(1))).toEqual([42]);
  });
});

describe('sample', () => {
  it('takes n distinct items', () => {
    const out = sample([1, 2, 3, 4, 5], 3, mulberry32(11));
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
    for (const v of out) expect([1, 2, 3, 4, 5]).toContain(v);
  });

  it('returns a full shuffled copy when n >= length', () => {
    const out = sample([1, 2, 3], 10, mulberry32(2));
    expect([...out].sort()).toEqual([1, 2, 3]);
  });

  it('returns an empty array for n <= 0', () => {
    expect(sample([1, 2, 3], 0, mulberry32(2))).toEqual([]);
    expect(sample([1, 2, 3], -1, mulberry32(2))).toEqual([]);
  });
});
