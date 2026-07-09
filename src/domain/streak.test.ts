import { describe, it, expect } from 'vitest';
import { computeStreak, localDayKey } from './streak';

describe('localDayKey', () => {
  it('formats a timestamp as a zero-padded local YYYY-MM-DD', () => {
    // Build the timestamp from local components so the assertion holds in any TZ.
    const ts = new Date(2026, 0, 5, 13, 30).getTime(); // 2026-01-05 local
    expect(localDayKey(ts)).toBe('2026-01-05');
  });

  it('pads single-digit months and days', () => {
    const ts = new Date(2026, 8, 9, 0, 0).getTime(); // 2026-09-09 local
    expect(localDayKey(ts)).toBe('2026-09-09');
  });
});

describe('computeStreak', () => {
  const today = '2026-07-08';

  it('returns zeros for no activity', () => {
    expect(computeStreak([], today)).toEqual({ current: 0, longest: 0, playedToday: false });
  });

  it('counts a run ending today when today is played', () => {
    const days = ['2026-07-06', '2026-07-07', '2026-07-08'];
    expect(computeStreak(days, today)).toEqual({ current: 3, longest: 3, playedToday: true });
  });

  it('keeps the streak alive on a run ending yesterday (today not yet played)', () => {
    const days = ['2026-07-06', '2026-07-07'];
    expect(computeStreak(days, today)).toEqual({ current: 2, longest: 2, playedToday: false });
  });

  it('breaks the streak when neither today nor yesterday was played (strict, no grace)', () => {
    // Played through the 6th, skipped the 7th — by the 8th the run is dead.
    const days = ['2026-07-04', '2026-07-05', '2026-07-06'];
    expect(computeStreak(days, today)).toMatchObject({ current: 0, playedToday: false });
  });

  it('ignores duplicate day-keys (many sessions in one day count once)', () => {
    const days = ['2026-07-07', '2026-07-07', '2026-07-08', '2026-07-08'];
    expect(computeStreak(days, today)).toMatchObject({ current: 2, playedToday: true });
  });

  it('reports the longest run independent of the current one', () => {
    // A 4-day run in the past; a 1-day run today. current=1, longest=4.
    const days = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-07-08'];
    expect(computeStreak(days, today)).toEqual({ current: 1, longest: 4, playedToday: true });
  });

  it('spans a month boundary correctly', () => {
    const days = ['2026-06-29', '2026-06-30', '2026-07-01'];
    expect(computeStreak(days, '2026-07-01')).toEqual({
      current: 3,
      longest: 3,
      playedToday: true,
    });
  });

  it('spans a year boundary correctly', () => {
    const days = ['2025-12-30', '2025-12-31', '2026-01-01'];
    expect(computeStreak(days, '2026-01-01')).toEqual({
      current: 3,
      longest: 3,
      playedToday: true,
    });
  });
});
