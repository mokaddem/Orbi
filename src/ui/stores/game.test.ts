import { afterEach, describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { mulberry32 } from '../../domain';
import { getCountries } from '../../data';
import { play, lastSummary, pendingConfig, focusIsosForConfig, type RunConfig } from './game';

// A deterministic clock: each read advances by 1s so durations are monotonic/positive.
function makeClock(): () => number {
  let ms = 0;
  return () => (ms += 1000);
}

function baseConfig(over: Partial<RunConfig> = {}): RunConfig {
  return { mode: 'flag-to-country', type: 'fixed', rng: mulberry32(42), now: makeClock(), ...over };
}

/** Answer the current question correctly and return whether the session finished. */
function answerCorrect(): void {
  const q = get(play).question!;
  play.answer(q.answer.iso2);
}

function currentWrongIso(): string {
  const q = get(play).question!;
  return q.options!.find((o) => o.iso2 !== q.answer.iso2)!.iso2;
}

afterEach(() => {
  play.reset();
  lastSummary.set(null);
  pendingConfig.set(null);
});

describe('play store', () => {
  it('starts idle', () => {
    expect(get(play).status).toBe('idle');
  });

  it('presents the first question on start', () => {
    play.start(baseConfig());
    const view = get(play);
    expect(view.status).toBe('playing');
    expect(view.question).not.toBeNull();
    expect(view.question!.options?.length).toBe(4);
    expect(view.state!.index).toBe(0);
    expect(view.feedback).toBeNull();
  });

  it('grades a correct answer and captures feedback (which survives submit clearing current)', () => {
    play.start(baseConfig());
    answerCorrect();
    const view = get(play);
    expect(view.status).toBe('answered');
    expect(view.feedback).not.toBeNull();
    expect(view.feedback!.correct).toBe(true);
    // The session itself clears `current` on submit; the store retains the question.
    expect(view.question).not.toBeNull();
    expect(view.state!.correct).toBe(1);
  });

  it('grades a wrong answer, records the miss, and reveals via feedback', () => {
    play.start(baseConfig());
    const answerIso = get(play).question!.answer.iso2;
    play.answer(currentWrongIso());
    const view = get(play);
    expect(view.status).toBe('answered');
    expect(view.feedback!.correct).toBe(false);
    expect(view.feedback!.question.answer.iso2).toBe(answerIso);
    expect(view.state!.correct).toBe(0);
  });

  it('advances to the next question without finishing mid-session', () => {
    play.start(baseConfig({ fixedLength: 3 }));
    answerCorrect();
    const finished = play.advance();
    expect(finished).toBe(false);
    const view = get(play);
    expect(view.status).toBe('playing');
    expect(view.state!.index).toBe(1);
    expect(view.feedback).toBeNull();
  });

  it('plays a fixed session to completion and produces a correct summary', () => {
    play.start(baseConfig({ fixedLength: 3 }));
    let finished = false;
    for (let i = 0; i < 3; i++) {
      answerCorrect();
      finished = play.advance();
    }
    expect(finished).toBe(true);
    expect(get(play).status).toBe('finished');

    const summary = play.summary()!;
    expect(summary.total).toBe(3);
    expect(summary.correct).toBe(3);
    expect(summary.accuracy).toBe(1);
    expect(summary.missed).toHaveLength(0);
    expect(summary.durationMs).toBeGreaterThan(0);
  });

  it('surfaces missed countries in the summary', () => {
    play.start(baseConfig({ fixedLength: 2 }));
    const firstAnswer = get(play).question!.answer.iso2;
    play.answer(currentWrongIso());
    play.advance();
    answerCorrect();
    play.advance();

    const summary = play.summary()!;
    expect(summary.total).toBe(2);
    expect(summary.correct).toBe(1);
    expect(summary.missed.map((c) => c.iso2)).toContain(firstAnswer);
  });

  it('ends a survival session when lives run out', () => {
    play.start(baseConfig({ type: 'survival', lives: 1 }));
    play.answer(currentWrongIso());
    expect(get(play).state!.livesRemaining).toBe(0);
    const finished = play.advance();
    expect(finished).toBe(true);
    expect(get(play).status).toBe('finished');
    expect(play.summary()!.correct).toBe(0);
  });

  it('runs a blitz session until endBlitz() is called — advance() never finishes it', () => {
    play.start(baseConfig({ type: 'blitz', filter: { region: 'Europe' } }));
    // Answer several questions; blitz keeps going (advance returns false every time).
    for (let i = 0; i < 6; i++) {
      answerCorrect();
      expect(play.advance()).toBe(false);
      expect(get(play).status).toBe('playing');
    }
    // The UI clock hits zero → endBlitz ends the run and emits 'finished'.
    play.endBlitz();
    expect(get(play).status).toBe('finished');
    expect(play.summary()!.correct).toBe(6);
    // A second endBlitz is a harmless no-op.
    play.endBlitz();
    expect(get(play).status).toBe('finished');
  });

  it('restricts questions and distractors to the selected region', () => {
    play.start(baseConfig({ filter: { region: 'Europe' } }));
    // Sample several questions; every answer and every option stays inside Europe.
    for (let i = 0; i < 8; i++) {
      const q = get(play).question!;
      expect(q.answer.region).toBe('Europe');
      expect(q.options).toHaveLength(4);
      for (const opt of q.options!) expect(opt.region).toBe('Europe');
      answerCorrect();
      play.advance();
    }
  });

  it('fills the default option count for the smallest region filter (Phase 19: no tiny pools)', () => {
    // Oceania is the smallest region (14) and, post-Phase-19, has no sub-buckets — it must
    // still fill all 4 options and play without cycling a degenerate pool.
    play.start(baseConfig({ filter: { region: 'Oceania' } }));
    for (let i = 0; i < 6; i++) {
      const q = get(play).question!;
      expect(q.answer.region).toBe('Oceania');
      expect(q.options).toHaveLength(4); // no reduced-option fallback needed anymore
      expect(new Set(q.options!.map((o) => o.iso2)).size).toBe(4); // 4 distinct options
      for (const opt of q.options!) expect(opt.region).toBe('Oceania');
      answerCorrect();
      play.advance();
    }
  });

  it('records the region filter in the summary', () => {
    play.start(baseConfig({ fixedLength: 2, filter: { region: 'Africa' } }));
    for (let i = 0; i < 2; i++) {
      answerCorrect();
      play.advance();
    }
    expect(play.summary()!.regionFilter).toEqual({ region: 'Africa' });
  });

  it('answer() returns the graded QuestionResult for SR recording', () => {
    play.start(baseConfig());
    const q = get(play).question!;
    const result = play.answer(q.answer.iso2);
    expect(result).not.toBeNull();
    expect(result!.itemKey).toBe(q.itemKey);
    expect(result!.correct).toBe(true);
    // No active question → null (idempotent second answer).
    expect(play.answer(q.answer.iso2)).toBeNull();
  });

  it('runs a training session over an explicit answer pool with world-wide distractors', () => {
    // Two specific countries to drill; distractors may come from anywhere.
    play.start(
      baseConfig({ type: 'training', answerPoolIso: ['BG', 'RO'], fixedLength: 6, choices: 4 }),
    );
    const askedAbout = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const q = get(play).question!;
      askedAbout.add(q.answer.iso2);
      expect(q.options).toHaveLength(4);
      answerCorrect();
      play.advance();
    }
    expect([...askedAbout].sort()).toEqual(['BG', 'RO']);
    expect(play.summary()!.type).toBe('training');
  });

  it('reset returns the store to idle and drops the session', () => {
    play.start(baseConfig());
    play.reset();
    const view = get(play);
    expect(view.status).toBe('idle');
    expect(view.question).toBeNull();
    expect(play.summary()).toBeNull();
  });
});

describe('focusIsosForConfig — the map crop for a session', () => {
  const countries = getCountries();
  const isosIn = (region: string) =>
    countries.filter((c) => c.region === region).map((c) => c.iso2);

  it('returns null (whole world) when there is no scope', () => {
    expect(focusIsosForConfig(countries, null)).toBeNull();
    expect(focusIsosForConfig(countries, baseConfig())).toBeNull();
  });

  it('frames to a region filter (normal region play / daily)', () => {
    const focus = focusIsosForConfig(countries, baseConfig({ filter: { region: 'Europe' } }));
    expect(focus).not.toBeNull();
    expect(new Set(focus)).toEqual(new Set(isosIn('Europe')));
  });

  it('frames to the sub-region when a sub-region filter is set', () => {
    const subregion = countries.find((c) => c.region === 'Europe')!.subregion;
    const focus = focusIsosForConfig(countries, baseConfig({ filter: { subregion } }));
    expect(focus).not.toBeNull();
    for (const iso of focus!) {
      expect(countries.find((c) => c.iso2 === iso)!.subregion).toBe(subregion);
    }
  });

  it('region-expands an answer pool: a Europe-only review frames to the whole Europe map', () => {
    // A region-scoped review carries its scope as answerPoolIso (a handful of due European
    // countries), *not* a filter — the map must still show all of Europe, not the world, and
    // not just the two pooled countries.
    const focus = focusIsosForConfig(
      countries,
      baseConfig({ type: 'training', answerPoolIso: ['FR', 'DE'] }),
    );
    expect(focus).not.toBeNull();
    expect(new Set(focus)).toEqual(new Set(isosIn('Europe')));
  });

  it('region-expands across every region an answer pool touches (global "review everything")', () => {
    const focus = focusIsosForConfig(
      countries,
      baseConfig({ type: 'training', answerPoolIso: ['FR', 'JP'] }),
    );
    const jpRegion = countries.find((c) => c.iso2 === 'JP')!.region;
    expect(new Set(focus)).toEqual(new Set([...isosIn('Europe'), ...isosIn(jpRegion)]));
  });

  it('falls back to the whole world when the answer pool resolves to no known region', () => {
    expect(
      focusIsosForConfig(countries, baseConfig({ type: 'training', answerPoolIso: ['ZZ'] })),
    ).toBeNull();
    expect(
      focusIsosForConfig(countries, baseConfig({ type: 'training', answerPoolIso: [] })),
    ).toBeNull();
  });
});
