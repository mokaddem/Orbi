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

  it('climbs bronze → silver → gold → platinum → crystal, three rungs to a band', () => {
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
      'platinum',
      'platinum',
      'platinum',
      'crystal',
      'crystal',
      'crystal',
    ]);
  });

  it('sets the reflection glint by sub-level (1★ none · 2★ mild · 3★ medium), apex prismatic', () => {
    // Each non-crystal band steps none → mild → medium with its stars.
    expect(RANK_MEDALS.slice(0, 3).map((m) => m.glint)).toEqual(['none', 'mild', 'medium']);
    expect(RANK_MEDALS.slice(6, 9).map((m) => m.glint)).toEqual(['none', 'mild', 'medium']);
    // The crowned top rung — and only it — is prismatic.
    const prismatic = RANK_MEDALS.filter((m) => m.glint === 'prismatic');
    expect(prismatic).toHaveLength(1);
    expect(RANK_MEDALS[RANK_MEDALS.length - 1].glint).toBe('prismatic');
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

  it('no longer draws the facet burst on the crystal apex', () => {
    const { container } = render(RankMedal, { index: RANK_MEDALS.length - 1 });
    expect(container.querySelector('.facets')).toBeNull();
    // The apex is the third crystal rung, so it wears its three sub-level stars like any 3★ coin.
    expect(container.querySelectorAll('.star')).toHaveLength(3);
  });

  it('sweeps a reflection glint on glinting coins but not on a plain 1★ coin', () => {
    // Novice (index 0) is 1★ / glint "none" — no sheen element at all.
    const { container: plain } = render(RankMedal, { index: 0 });
    expect(plain.querySelector('.sheen')).toBeNull();

    // The crowned apex glints prismatically.
    const { container: apex } = render(RankMedal, { index: RANK_MEDALS.length - 1 });
    expect(apex.querySelector('.sheen.sheen-prismatic')).not.toBeNull();
    expect(apex.querySelector('svg.medal.apex')).not.toBeNull();
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
