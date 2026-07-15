import { afterEach, describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { mulberry32 } from '../../domain';
import { getCountries } from '../../data';
import { challenge, lastChallengeSummary, pendingChallenge } from './challenge';
import { summaryToRecord } from './persistence';

/** A deterministic clock: each read advances 1s so durations stay monotonic/positive. */
function makeClock(): () => number {
  let ms = 0;
  return () => (ms += 1000);
}

/** Oceania is the smallest continent — the cheapest full clear to drive in a test. */
const OCEANIA = getCountries().filter((c) => c.region === 'Oceania');

function startFlagsOceania(): void {
  challenge.start({ family: 'flags', region: 'Oceania', rng: mulberry32(42), now: makeClock() });
}

function answerCorrect(): void {
  challenge.answer(get(challenge).question!.answer.iso2);
}

/** Drive a run to the end, answering correctly except (optionally) a miss at slot `wrongAt`. */
function driveAll(wrongAt = -1): void {
  let i = 0;
  let done = false;
  while (!done) {
    const q = get(challenge).question;
    if (!q) break;
    challenge.answer(i === wrongAt ? null : q.answer.iso2);
    done = challenge.advance();
    i++;
  }
}

afterEach(() => {
  challenge.reset();
  lastChallengeSummary.set(null);
  pendingChallenge.set(null);
});

describe('challenge store', () => {
  it('starts idle', () => {
    expect(get(challenge).status).toBe('idle');
  });

  it('presents the first question with the WHOLE continent as fixed options', () => {
    startFlagsOceania();
    const view = get(challenge);
    expect(view.status).toBe('playing');
    expect(view.question).not.toBeNull();
    expect(view.question!.options).toHaveLength(OCEANIA.length); // no 4-choice crutch
    expect(view.state!.total).toBe(OCEANIA.length * 2); // both directions
    expect(view.state!.cleared).toBe(0);
    expect(view.feedback).toBeNull();
  });

  it('grades a correct answer and advances the cleared count', () => {
    startFlagsOceania();
    answerCorrect();
    const view = get(challenge);
    expect(view.status).toBe('answered');
    expect(view.feedback!.correct).toBe(true);
    expect(view.state!.cleared).toBe(1);
  });

  it('is one life: a single miss ends the run (no recycle, no pass)', () => {
    startFlagsOceania();
    challenge.answer(null); // miss the very first question
    expect(get(challenge).feedback!.correct).toBe(false);
    const finished = challenge.advance();
    expect(finished).toBe(true);
    const view = get(challenge);
    expect(view.status).toBe('finished');
    expect(view.state!.failed).toBe(true);
    expect(challenge.summary()!.passed).toBe(false);
    expect(challenge.summary()!.cleared).toBe(0);
  });

  it('passes on a clean sweep of the whole board', () => {
    startFlagsOceania();
    driveAll();
    expect(get(challenge).status).toBe('finished');
    const summary = challenge.summary()!;
    expect(summary.passed).toBe(true);
    expect(summary.cleared).toBe(OCEANIA.length * 2);
    expect(summary.total).toBe(OCEANIA.length * 2);
    expect(summary.missed).toBeNull();
  });

  it('keeps every question inside the continent with full-region options', () => {
    startFlagsOceania();
    for (let i = 0; i < 6; i++) {
      const q = get(challenge).question!;
      expect(q.answer.region).toBe('Oceania');
      expect(q.options).toHaveLength(OCEANIA.length);
      for (const opt of q.options!) expect(opt.region).toBe('Oceania');
      answerCorrect();
      challenge.advance();
    }
  });

  it('drives the capitals family (a country-pick + an attribute direction) to a pass', () => {
    challenge.start({
      family: 'capitals',
      region: 'Oceania',
      rng: mulberry32(7),
      now: makeClock(),
    });
    driveAll();
    expect(challenge.summary()!.passed).toBe(true);
  });

  it('adapts a finished run to a standard SessionSummary (pass)', () => {
    startFlagsOceania();
    driveAll();
    const ss = challenge.sessionSummary()!;
    expect(ss.type).toBe('challenge');
    expect(ss.mode).toBe('flag-to-country'); // representative direction of the flags family
    expect(ss.regionFilter).toEqual({ region: 'Oceania' });
    expect(ss.total).toBe(OCEANIA.length * 2);
    expect(ss.correct).toBe(OCEANIA.length * 2);
    expect(ss.accuracy).toBe(1);
    expect(ss.missed).toEqual([]);
  });

  it('records a challenge run onto a SessionRecord via the ordinary persistence bridge', () => {
    startFlagsOceania();
    driveAll(3); // clear 3, then miss the 4th
    const rec = summaryToRecord(challenge.sessionSummary()!);
    expect(rec.type).toBe('challenge');
    expect(rec.mode).toBe('flag-to-country');
    expect(rec.regionFilter).toEqual({ region: 'Oceania' });
    expect(rec.total).toBe(OCEANIA.length * 2);
    expect(rec.correct).toBe(3);
    expect(rec.questions).toHaveLength(4); // 3 cleared + the fatal miss
    expect(rec.points).toBeUndefined(); // points cache is blitz-only
  });

  it('answer() returns the graded QuestionResult (for SR recording) and is idempotent', () => {
    startFlagsOceania();
    const q = get(challenge).question!;
    const result = challenge.answer(q.answer.iso2);
    expect(result).not.toBeNull();
    expect(result!.itemKey).toBe(q.itemKey);
    expect(result!.correct).toBe(true);
    expect(challenge.answer(q.answer.iso2)).toBeNull(); // no active question now
  });

  it('reset returns the store to idle and drops the run', () => {
    startFlagsOceania();
    challenge.reset();
    expect(get(challenge).status).toBe('idle');
    expect(challenge.summary()).toBeNull();
  });
});
