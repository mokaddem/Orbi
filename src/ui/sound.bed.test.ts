import { describe, it, expect } from 'vitest';
import { bedTierFor, bedVoices, BED_STEPS, BED_TIER_MAX } from './sound.bed';

describe('the Rising Bed voice model (Phase 44)', () => {
  it('normalizes progress into 10 tiers for any run length', () => {
    expect(bedTierFor(0, 100)).toBe(0);
    expect(bedTierFor(9, 100)).toBe(0);
    expect(bedTierFor(10, 100)).toBe(1);
    expect(bedTierFor(50, 100)).toBe(5);
    expect(bedTierFor(99, 100)).toBe(9);
    expect(bedTierFor(100, 100)).toBe(9); // clamped at the top tier
    // A short run still spans all tiers, just faster.
    expect(bedTierFor(0, 20)).toBe(0);
    expect(bedTierFor(2, 20)).toBe(1);
    expect(bedTierFor(19, 20)).toBe(9);
  });

  it('is safe for a zero-length / empty run', () => {
    expect(bedTierFor(0, 0)).toBe(0);
    expect(bedTierFor(5, 0)).toBe(0);
  });

  it('accumulates layers: a higher tier never plays fewer voices across the loop', () => {
    // Sum the voices generated across a whole loop at each tier — non-decreasing (each tier only
    // stacks a layer on top), and strictly greater from tier 0 to the top.
    const perLoop = (tier: number): number => {
      let n = 0;
      for (let p = 0; p < BED_STEPS; p++) n += bedVoices(tier, p).length;
      return n;
    };
    const totals = Array.from({ length: BED_TIER_MAX + 1 }, (_, t) => perLoop(t));
    for (let i = 1; i < totals.length; i++) expect(totals[i]).toBeGreaterThanOrEqual(totals[i - 1]);
    expect(totals[BED_TIER_MAX]).toBeGreaterThan(totals[0]);
  });

  it('clamps out-of-range tiers to the nearest valid tier', () => {
    const t0 = bedVoices(0, 0).length;
    const tMax = bedVoices(BED_TIER_MAX, 0).length;
    expect(bedVoices(-5, 0).length).toBe(t0);
    expect(bedVoices(99, 0).length).toBe(tMax);
  });

  it('always lays the foundation groove on the downbeat, even at tier 0', () => {
    // Step 0 fires booms + crash + drone at every tier (the foundation is present throughout).
    expect(bedVoices(0, 0).length).toBeGreaterThan(0);
  });
});
