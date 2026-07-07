import { describe, it, expect } from 'vitest';
import type { SRItem } from '../data/persistence/types';
import type { QuestionResult } from './types';
import {
  DEFAULT_EASE,
  MIN_EASE,
  MS_PER_DAY,
  FAST_ANSWER_MS,
  SLOW_ANSWER_MS,
  gradeAnswer,
  newSRItem,
  scheduleNext,
} from './sr';

const NOW = 1_000_000;

function result(over: Partial<QuestionResult> = {}): QuestionResult {
  return {
    itemKey: 'flag-to-country:BG',
    countryIso2: 'BG',
    correct: true,
    answerMs: 1000,
    ...over,
  };
}

/** Review an item `times` in a row with the same result, threading state forward. */
function reviewRepeatedly(
  seed: SRItem | undefined,
  r: QuestionResult,
  times: number,
  now = NOW,
): SRItem {
  let item = seed;
  for (let i = 0; i < times; i++) item = scheduleNext(item, r, now);
  return item!;
}

describe('gradeAnswer', () => {
  it('grades any incorrect answer as a hard failure (0)', () => {
    expect(gradeAnswer(result({ correct: false, answerMs: 200 }))).toBe(0);
    expect(gradeAnswer(result({ correct: false, answerMs: 99_999 }))).toBe(0);
  });

  it('grades a fast correct answer highest (5)', () => {
    expect(gradeAnswer(result({ correct: true, answerMs: FAST_ANSWER_MS }))).toBe(5);
    expect(gradeAnswer(result({ correct: true, answerMs: 0 }))).toBe(5);
  });

  it('grades a slow correct answer as merely passing (3)', () => {
    expect(gradeAnswer(result({ correct: true, answerMs: SLOW_ANSWER_MS }))).toBe(3);
    expect(gradeAnswer(result({ correct: true, answerMs: 20_000 }))).toBe(3);
  });

  it('grades a mid-speed correct answer as 4', () => {
    expect(
      gradeAnswer(result({ correct: true, answerMs: (FAST_ANSWER_MS + SLOW_ANSWER_MS) / 2 })),
    ).toBe(4);
  });
});

describe('newSRItem', () => {
  it('is due immediately with canonical defaults', () => {
    const item = newSRItem('flag-to-country:BG', NOW);
    expect(item).toEqual({
      itemKey: 'flag-to-country:BG',
      repetitions: 0,
      easeFactor: DEFAULT_EASE,
      intervalDays: 0,
      dueAt: NOW,
      lapses: 0,
    });
  });
});

describe('scheduleNext — correct answers', () => {
  it('seeds a never-seen item from the result key', () => {
    const item = scheduleNext(undefined, result({ answerMs: FAST_ANSWER_MS }), NOW);
    expect(item.itemKey).toBe('flag-to-country:BG');
    expect(item.repetitions).toBe(1);
    expect(item.intervalDays).toBe(1);
    expect(item.lapses).toBe(0);
    expect(item.lastReviewedAt).toBe(NOW);
    expect(item.dueAt).toBe(NOW + MS_PER_DAY);
  });

  it('follows the 1 → 6 → ×EF interval progression', () => {
    const r = result({ answerMs: FAST_ANSWER_MS }); // quality 5, ease nudges up
    const first = scheduleNext(undefined, r, NOW);
    expect(first.intervalDays).toBe(1);

    const second = scheduleNext(first, r, NOW);
    expect(second.repetitions).toBe(2);
    expect(second.intervalDays).toBe(6);

    const third = scheduleNext(second, r, NOW);
    expect(third.repetitions).toBe(3);
    expect(third.intervalDays).toBe(Math.round(6 * third.easeFactor));
    expect(third.intervalDays).toBeGreaterThan(6);
  });

  it('raises the ease factor for easy (fast) recalls', () => {
    const item = scheduleNext(undefined, result({ answerMs: 0 }), NOW);
    expect(item.easeFactor).toBeGreaterThan(DEFAULT_EASE);
  });

  it('keeps a due date exactly intervalDays ahead of now', () => {
    const item = scheduleNext(undefined, result({ answerMs: FAST_ANSWER_MS }), NOW);
    expect(item.dueAt).toBe(NOW + item.intervalDays * MS_PER_DAY);
  });
});

describe('scheduleNext — incorrect answers (lapses)', () => {
  it('resets repetitions and interval, and increments lapses', () => {
    // Build up a well-known item, then miss it.
    const known = reviewRepeatedly(undefined, result({ answerMs: FAST_ANSWER_MS }), 3);
    expect(known.repetitions).toBe(3);
    expect(known.intervalDays).toBeGreaterThan(6);

    const missed = scheduleNext(known, result({ correct: false }), NOW);
    expect(missed.repetitions).toBe(0);
    expect(missed.intervalDays).toBe(0);
    expect(missed.lapses).toBe(1);
    expect(missed.dueAt).toBe(NOW); // due immediately
  });

  it('makes a missed item resurface far sooner than a known one', () => {
    const known = reviewRepeatedly(undefined, result({ answerMs: FAST_ANSWER_MS }), 3, NOW);
    const missed = scheduleNext(undefined, result({ correct: false }), NOW);
    // The known item is scheduled many days out; the missed one is due right now.
    expect(missed.dueAt).toBeLessThan(known.dueAt);
    expect(missed.dueAt).toBe(NOW);
    expect(missed.intervalDays).toBe(0);
  });

  it('drives the ease factor down toward the floor under repeated misses', () => {
    const missed = reviewRepeatedly(undefined, result({ correct: false }), 5, NOW);
    expect(missed.easeFactor).toBe(MIN_EASE);
    expect(missed.lapses).toBe(5);
  });

  it('models the Bulgaria/Romania confusion: repeated misses accrue lapses and short intervals', () => {
    const bg = reviewRepeatedly(
      undefined,
      result({ itemKey: 'map-highlight:BG', countryIso2: 'BG', correct: false }),
      3,
    );
    const ro = reviewRepeatedly(
      undefined,
      result({ itemKey: 'map-highlight:RO', countryIso2: 'RO', correct: false }),
      3,
    );
    for (const item of [bg, ro]) {
      expect(item.lapses).toBe(3);
      expect(item.intervalDays).toBe(0); // always due immediately
      expect(item.dueAt).toBe(NOW);
      expect(item.easeFactor).toBe(MIN_EASE);
    }
  });
});
