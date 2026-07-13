import { describe, it, expect } from 'vitest';
import { STREAK_MILESTONES, streakTier, isStreakMilestone } from './streak';

describe('streak tiers (Phase 39)', () => {
  it('is -1 below the first milestone (plain "correct" cue plays)', () => {
    expect(streakTier(0)).toBe(-1);
    expect(streakTier(1)).toBe(-1);
    expect(streakTier(2)).toBe(-1);
  });

  it('sticks at a tier once its milestone is reached', () => {
    // milestones [3, 5, 10, 15, 20] → tiers 0..4
    expect(streakTier(3)).toBe(0);
    expect(streakTier(4)).toBe(0); // still tier 0 between milestones — no fallback to "correct"
    expect(streakTier(5)).toBe(1);
    expect(streakTier(9)).toBe(1);
    expect(streakTier(10)).toBe(2);
    expect(streakTier(14)).toBe(2);
    expect(streakTier(15)).toBe(3);
    expect(streakTier(19)).toBe(3);
    expect(streakTier(20)).toBe(4);
  });

  it('caps at the top tier past the last milestone', () => {
    expect(streakTier(21)).toBe(4);
    expect(streakTier(100)).toBe(4);
    expect(streakTier(20)).toBe(STREAK_MILESTONES.length - 1);
  });

  it('never decreases as the streak grows (monotonic)', () => {
    let prev = -1;
    for (let s = 0; s <= 25; s++) {
      const t = streakTier(s);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  it('flags exactly the milestone streak values for the indicator pop', () => {
    for (let s = 0; s <= 25; s++) {
      expect(isStreakMilestone(s)).toBe(STREAK_MILESTONES.includes(s));
    }
    // spot checks: pop at 3/5/10/15/20, not between
    expect(isStreakMilestone(3)).toBe(true);
    expect(isStreakMilestone(4)).toBe(false);
    expect(isStreakMilestone(20)).toBe(true);
    expect(isStreakMilestone(21)).toBe(false);
  });
});
