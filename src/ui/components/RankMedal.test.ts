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

  it('gives each band its motion character (owner-picked), with the crystal band layering aurora + sweep', () => {
    const effectsOf = (i: number) => RANK_MEDALS[i].effects;
    // Bronze/silver: plain sweep, but the 1★ rung of each band stays still.
    expect(effectsOf(0)).toEqual([]); // Novice (bronze 1★)
    expect(effectsOf(1)).toEqual(['sweep']); // Scout (bronze 2★)
    expect(effectsOf(3)).toEqual([]); // Pathfinder (silver 1★)
    // Gold sparkles, platinum shimmers, crystal drifts an aurora under a sweep.
    expect(RANK_MEDALS.slice(6, 9).every((m) => m.effects.includes('sparkle'))).toBe(true);
    expect(RANK_MEDALS.slice(9, 12).every((m) => m.effects.includes('shimmer'))).toBe(true);
    expect(RANK_MEDALS.slice(12, 15).every((m) => m.effects.join() === 'aurora,sweep')).toBe(true);
  });

  it('ramps effect intensity mild → medium → strong across each of the upper bands', () => {
    expect(RANK_MEDALS.slice(6, 9).map((m) => m.intensity)).toEqual(['mild', 'medium', 'strong']);
    expect(RANK_MEDALS.slice(9, 12).map((m) => m.intensity)).toEqual(['mild', 'medium', 'strong']);
    expect(RANK_MEDALS.slice(12, 15).map((m) => m.intensity)).toEqual(['mild', 'medium', 'strong']);
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

  it('renders the per-band motion layers, and none on a plain 1★ coin', () => {
    // Novice (index 0) is bronze 1★ — a still coin, no motion overlays.
    const { container: plain } = render(RankMedal, { index: 0 });
    expect(plain.querySelector('.sweep, .sparkle, .shimmer, .aurora, .spk')).toBeNull();

    // Globetrotter (gold 3★) sparkles.
    const { container: gold } = render(RankMedal, { index: 8 });
    expect(gold.querySelectorAll('.spk').length).toBeGreaterThan(0);

    // Vanguard (platinum 3★) shimmers.
    const { container: plat } = render(RankMedal, { index: 11 });
    expect(plat.querySelector('.shimmer')).not.toBeNull();

    // The crowned apex layers aurora + sweep.
    const { container: apex } = render(RankMedal, { index: RANK_MEDALS.length - 1 });
    expect(apex.querySelector('.aurora')).not.toBeNull();
    expect(apex.querySelector('.sweep')).not.toBeNull();
    // The old facet burst is gone; the apex still wears its three sub-level stars.
    expect(apex.querySelector('.facets')).toBeNull();
    expect(apex.querySelectorAll('.star')).toHaveLength(3);
  });

  it('is decorative by default and labelled when given a title', () => {
    const { container, rerender } = render(RankMedal, { index: 0 });
    const medal = container.querySelector('.rank-medal');
    expect(medal).toHaveAttribute('aria-hidden', 'true');

    rerender({ index: 0, title: 'Novice' });
    const labelled = container.querySelector('.rank-medal');
    expect(labelled).toHaveAttribute('role', 'img');
    expect(labelled).toHaveAttribute('aria-label', 'Novice');
  });
});
