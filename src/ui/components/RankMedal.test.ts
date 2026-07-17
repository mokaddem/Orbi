import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import RankMedal from './RankMedal.svelte';
import { rankMedal, RANK_MEDALS } from './rankMedal';

describe('rankMedal()', () => {
  it('maps every rank index to a distinct glyph', () => {
    const glyphs = RANK_MEDALS.map((m) => m.glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it('climbs bronze → silver → gold, three to a band, then a crystal apex', () => {
    expect(RANK_MEDALS.map((m) => m.metal)).toEqual([
      'bronze',
      'bronze',
      'bronze',
      'silver',
      'silver',
      'silver',
      'gold',
      'gold',
      'gold',
      'crystal',
    ]);
  });

  it('floors and clamps out-of-range indices to the ladder', () => {
    expect(rankMedal(-5)).toBe(RANK_MEDALS[0]);
    expect(rankMedal(2.9)).toBe(RANK_MEDALS[2]);
    expect(rankMedal(99)).toBe(RANK_MEDALS[RANK_MEDALS.length - 1]);
  });
});

describe('RankMedal', () => {
  it('strikes one star per sub-level on the coin rim', () => {
    // Wanderer (index 2) is the third bronze rung → 3 stars.
    const { container } = render(RankMedal, { index: 2 });
    expect(container.querySelectorAll('.star')).toHaveLength(3);
  });

  it('gives the crystal apex facets and no stars', () => {
    const { container } = render(RankMedal, { index: RANK_MEDALS.length - 1 });
    expect(container.querySelectorAll('.star')).toHaveLength(0);
    expect(container.querySelector('.facets')).not.toBeNull();
  });

  it('draws facets only on the apex', () => {
    const { container } = render(RankMedal, { index: 0 });
    expect(container.querySelector('.facets')).toBeNull();
  });

  it('is decorative by default and labelled when given a title', () => {
    const { container, rerender } = render(RankMedal, { index: 0 });
    const svg = container.querySelector('svg.medal');
    expect(svg).toHaveAttribute('aria-hidden', 'true');

    rerender({ index: 0, title: 'Novice' });
    const labelled = container.querySelector('svg.medal');
    expect(labelled).toHaveAttribute('role', 'img');
    expect(labelled).toHaveAttribute('aria-label', 'Novice');
  });
});
