import { describe, it, expect } from 'vitest';
import { median, inlierMask } from './robust-stats';

describe('median', () => {
  it('is NaN for an empty array', () => {
    expect(median([])).toBeNaN();
  });
  it('takes the middle of an odd-length sorted array', () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
  });
  it('averages the two middles of an even-length sorted array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('inlierMask', () => {
  it('is empty for no values', () => {
    expect(inlierMask([])).toEqual([]);
  });

  it('keeps everything within the ±60° floor when the spread is tight', () => {
    // A tight cluster: MAD is small, so the 60° floor dominates and nothing is trimmed.
    expect(inlierMask([10, 12, 15, 11, 14])).toEqual([true, true, true, true, true]);
  });

  it('drops a single far outlier beyond the floor', () => {
    // 10..14 are the median-ish body; 200 is >60° away and gets masked out.
    const mask = inlierMask([10, 11, 12, 13, 14, 200]);
    expect(mask).toEqual([true, true, true, true, true, false]);
  });

  it('keeps a genuinely wide but continuous spread whole', () => {
    // Pole-to-pole latitudes of the Americas (Canada→Chile): the spread is wide but
    // continuous, so the MAD is large and 3·MAD (not the floor) keeps every point.
    const lats = [60, 40, 23, 4, -10, -35, -30];
    expect(inlierMask(lats).every(Boolean)).toBe(true);
  });
});
