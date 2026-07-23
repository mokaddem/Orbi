import { describe, it, expect } from 'vitest';
import { DAILY_STREAK_MILESTONES, dailyStreakTier, dailyFlameSpec } from './dailyStreak';

describe('dailyStreakTier', () => {
  it('is -1 for a non-streak (0, negative, non-finite)', () => {
    expect(dailyStreakTier(0)).toBe(-1);
    expect(dailyStreakTier(-5)).toBe(-1);
    expect(dailyStreakTier(NaN)).toBe(-1);
    expect(dailyStreakTier(Infinity)).toBe(-1); // non-finite guarded to inactive
  });

  it('lands on each milestone boundary exactly', () => {
    // [1, 3, 7, 14, 30, 60, 90, 180, 365] → tiers 0..8
    DAILY_STREAK_MILESTONES.forEach((day, tier) => {
      expect(dailyStreakTier(day)).toBe(tier);
      // one day short of the next milestone stays on this tier
      const next = DAILY_STREAK_MILESTONES[tier + 1];
      if (next !== undefined) expect(dailyStreakTier(next - 1)).toBe(tier);
    });
  });

  it('holds a day below the first milestone at -1 and caps past a year', () => {
    expect(dailyStreakTier(0.5)).toBe(-1);
    expect(dailyStreakTier(1)).toBe(0);
    expect(dailyStreakTier(365)).toBe(8);
    expect(dailyStreakTier(10_000)).toBe(8);
  });
});

describe('dailyFlameSpec', () => {
  it('returns an inactive, unlit spec for no streak', () => {
    const s = dailyFlameSpec(0);
    expect(s.active).toBe(false);
    expect(s.tier).toBe(-1);
    expect(s.embers).toBe(0);
    expect(s.glow).toBe(0);
  });

  it('is active from day one and caps at the top tier past a year', () => {
    expect(dailyFlameSpec(1).active).toBe(true);
    expect(dailyFlameSpec(1).tier).toBe(0);
    expect(dailyFlameSpec(400).tier).toBe(DAILY_STREAK_MILESTONES.length - 1);
  });

  it('escalates monotonically up the ladder — more embers, glow and swell each tier', () => {
    const specs = DAILY_STREAK_MILESTONES.map((d) => dailyFlameSpec(d));
    for (let i = 1; i < specs.length; i++) {
      expect(specs[i].embers).toBeGreaterThanOrEqual(specs[i - 1].embers);
      expect(specs[i].glow).toBeGreaterThan(specs[i - 1].glow);
      expect(specs[i].scale).toBeGreaterThan(specs[i - 1].scale);
      // the flame quickens (shorter period) as it heats up
      expect(specs[i].speedMs).toBeLessThan(specs[i - 1].speedMs);
    }
    // ends strictly denser than it began
    expect(specs[specs.length - 1].embers).toBeGreaterThan(specs[0].embers);
  });

  it('gives every active tier a heat colour', () => {
    DAILY_STREAK_MILESTONES.forEach((d) => {
      expect(dailyFlameSpec(d).heat).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});
