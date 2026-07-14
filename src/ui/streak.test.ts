import { describe, it, expect } from 'vitest';
import { STREAK_MILESTONES, streakTier, isStreakMilestone, streakBurstSpec } from './streak';

describe('streak tiers (Phase 39)', () => {
  it('is -1 below the first milestone (plain "correct" cue plays)', () => {
    expect(streakTier(0)).toBe(-1);
    expect(streakTier(1)).toBe(-1);
    expect(streakTier(2)).toBe(-1);
  });

  it('sticks at a tier once its milestone is reached', () => {
    // milestones [3, 5, 10, 15, 20, 25, 30, 40, 50] → tiers 0..8
    expect(streakTier(3)).toBe(0);
    expect(streakTier(4)).toBe(0); // still tier 0 between milestones — no fallback to "correct"
    expect(streakTier(5)).toBe(1);
    expect(streakTier(9)).toBe(1);
    expect(streakTier(10)).toBe(2);
    expect(streakTier(14)).toBe(2);
    expect(streakTier(15)).toBe(3);
    expect(streakTier(19)).toBe(3);
    expect(streakTier(20)).toBe(4);
    expect(streakTier(24)).toBe(4);
    expect(streakTier(25)).toBe(5);
    expect(streakTier(29)).toBe(5);
    expect(streakTier(30)).toBe(6);
    expect(streakTier(39)).toBe(6);
    expect(streakTier(40)).toBe(7);
    expect(streakTier(49)).toBe(7);
    expect(streakTier(50)).toBe(8);
  });

  it('caps at the top tier past the last milestone', () => {
    expect(streakTier(51)).toBe(8);
    expect(streakTier(100)).toBe(8);
    expect(streakTier(50)).toBe(STREAK_MILESTONES.length - 1);
  });

  it('never decreases as the streak grows (monotonic)', () => {
    let prev = -1;
    for (let s = 0; s <= 55; s++) {
      const t = streakTier(s);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  it('flags exactly the milestone streak values for the indicator pop', () => {
    for (let s = 0; s <= 55; s++) {
      expect(isStreakMilestone(s)).toBe(STREAK_MILESTONES.includes(s));
    }
    // spot checks: pop at milestones, not between
    expect(isStreakMilestone(3)).toBe(true);
    expect(isStreakMilestone(4)).toBe(false);
    expect(isStreakMilestone(25)).toBe(true);
    expect(isStreakMilestone(50)).toBe(true);
    expect(isStreakMilestone(51)).toBe(false);
  });
});

describe('streak burst spec (Phase 42)', () => {
  const TOP = STREAK_MILESTONES.length - 1; // 8

  it('clamps the tier into the milestone range', () => {
    expect(streakBurstSpec(-5).tier).toBe(0);
    expect(streakBurstSpec(0).tier).toBe(0);
    expect(streakBurstSpec(TOP).tier).toBe(TOP);
    expect(streakBurstSpec(999).tier).toBe(TOP);
    expect(streakBurstSpec(3.4).tier).toBe(3); // rounds
  });

  it('escalates monotonically by density, depth and brightness cues', () => {
    let prevScale = 0;
    let prevGlow = 0;
    let prevSparks = -1;
    let prevDur = 0;
    let prevRings = -1;
    for (let t = 0; t <= TOP; t++) {
      const s = streakBurstSpec(t);
      expect(s.peakScale).toBeGreaterThan(prevScale);
      expect(s.glow).toBeGreaterThan(prevGlow);
      expect(s.sparks).toBeGreaterThanOrEqual(prevSparks);
      expect(s.durMs).toBeGreaterThan(prevDur);
      expect(s.rings).toBeGreaterThanOrEqual(prevRings);
      prevScale = s.peakScale;
      prevGlow = s.glow;
      prevSparks = s.sparks;
      prevDur = s.durMs;
      prevRings = s.rings;
    }
  });

  it('layers depth in as tiers climb: rings → aura → screen flash', () => {
    // no rings below tier 3, one from 3, a second from 6
    expect(streakBurstSpec(0).rings).toBe(0);
    expect(streakBurstSpec(2).rings).toBe(0);
    expect(streakBurstSpec(3).rings).toBe(1);
    expect(streakBurstSpec(5).rings).toBe(1);
    expect(streakBurstSpec(6).rings).toBe(2);
    expect(streakBurstSpec(8).rings).toBe(2);
    // aura is a high-tier addition; the screen flash is the peak only
    expect(streakBurstSpec(6).aura).toBe(false);
    expect(streakBurstSpec(7).aura).toBe(true);
    expect(streakBurstSpec(7).screenFlash).toBe(false);
    expect(streakBurstSpec(TOP).screenFlash).toBe(true);
  });

  it('gives every tier a heat colour, teal at the base', () => {
    for (let t = 0; t <= TOP; t++) {
      expect(streakBurstSpec(t).heat).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(streakBurstSpec(0).heat.toLowerCase()).toBe('#10a5a0'); // --color-accent
  });
});
