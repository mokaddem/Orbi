import { describe, it, expect } from 'vitest';
import { pickSummaryReaction, isStreakMilestone, pickStreakReaction } from './mascot';

describe('pickSummaryReaction', () => {
  it('cheers (with confetti) on a flawless run', () => {
    expect(pickSummaryReaction({ accuracy: 1, total: 10 })).toEqual({
      pose: 'cheer',
      animate: 'cheer',
    });
  });

  it('is proud on a strong run (>= 0.8)', () => {
    expect(pickSummaryReaction({ accuracy: 0.9, total: 10 })).toEqual({
      pose: 'proud',
      animate: 'bounce-in',
    });
    // Boundary: exactly 0.8 is still "proud".
    expect(pickSummaryReaction({ accuracy: 0.8, total: 10 }).pose).toBe('proud');
  });

  it('celebrates calmly on a solid run (0.5..0.8)', () => {
    expect(pickSummaryReaction({ accuracy: 0.6, total: 10 }).pose).toBe('celebrate');
    // Boundary: exactly 0.5 is "celebrate", not "encouraging".
    expect(pickSummaryReaction({ accuracy: 0.5, total: 10 }).pose).toBe('celebrate');
  });

  it('encourages (never mocks) on a rough run (< 0.5)', () => {
    expect(pickSummaryReaction({ accuracy: 0.3, total: 10 })).toEqual({
      pose: 'encouraging',
      animate: 'bounce-in',
    });
    expect(pickSummaryReaction({ accuracy: 0, total: 10 }).pose).toBe('encouraging');
  });

  it('stays still and thoughtful for an empty summary', () => {
    expect(pickSummaryReaction({ accuracy: 0, total: 0 })).toEqual({
      pose: 'thinking',
      animate: 'none',
    });
    // Accuracy is meaningless when nothing was played, even if it reads as 1.
    expect(pickSummaryReaction({ accuracy: 1, total: 0 }).pose).toBe('thinking');
  });
});

describe('isStreakMilestone', () => {
  it('flags the early milestones and every 50 days, plus a year', () => {
    for (const d of [3, 7, 14, 30, 50, 100, 150, 350, 365, 400]) {
      expect(isStreakMilestone(d), `${d} should be a milestone`).toBe(true);
    }
  });

  it('is false for ordinary days and non-positive/non-integer input', () => {
    for (const d of [1, 2, 4, 8, 29, 31, 51, 99]) {
      expect(isStreakMilestone(d), `${d} should not be a milestone`).toBe(false);
    }
    expect(isStreakMilestone(0)).toBe(false);
    expect(isStreakMilestone(-50)).toBe(false);
    expect(isStreakMilestone(7.5)).toBe(false);
  });
});

describe('pickStreakReaction', () => {
  it('gives a proud wiggle on a milestone day', () => {
    expect(pickStreakReaction(7)).toEqual({ pose: 'proud', animate: 'wiggle' });
  });

  it('stays relaxed and still on a non-milestone day', () => {
    expect(pickStreakReaction(8)).toEqual({ pose: 'relaxed', animate: 'none' });
  });
});
