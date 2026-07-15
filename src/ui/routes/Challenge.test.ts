import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Challenge from './Challenge.svelte';
import { challenge, pendingChallenge, lastChallengeSummary } from '../stores/challenge';
import { lastSummary, lastBlitzResult } from '../stores/game';
import { mulberry32 } from '../../domain';
import { setLocale } from '../../i18n';

// Fatal-miss dwell before the run finalizes to the Summary (mirrors Challenge.svelte's REVEAL_MS).
const REVEAL_MS = 3200;

/** A monotonic clock, so a run's timing is deterministic in tests. */
function clock(): () => number {
  let ms = 0;
  return () => (ms += 1000);
}

/** Stage a seeded Flags × Oceania run (the smallest continent; no map chunk to lazy-load). */
function stage(): void {
  pendingChallenge.set({ family: 'flags', region: 'Oceania', rng: mulberry32(7), now: clock() });
}

function pickButton(container: HTMLElement, id: string): HTMLButtonElement {
  return container.querySelector(`button[data-id="${id}"]`) as HTMLButtonElement;
}

beforeEach(() => {
  setLocale('en');
  challenge.reset();
  pendingChallenge.set(null);
  lastChallengeSummary.set(null);
  lastSummary.set(null);
  lastBlitzResult.set(null);
});

afterEach(() => {
  challenge.reset();
  pendingChallenge.set(null);
});

describe('Challenge route', () => {
  it('auto-starts the staged run and shows the clear-the-board, one-life HUD', () => {
    stage();
    render(Challenge);
    expect(get(challenge).status).toBe('playing');
    const total = get(challenge).state!.total;
    expect(total).toBeGreaterThan(0);
    // Both directions of every eligible country → 2 × N slots.
    expect(screen.getByText(new RegExp(`0 / ${total} cleared`))).toBeInTheDocument();
    expect(screen.getByText('One life')).toBeInTheDocument();
  });

  it('a correct pick clears a slot from the whole-continent pool', async () => {
    stage();
    const { container } = render(Challenge);
    const answer = get(challenge).question!.answer.iso2;
    // The pool is the whole continent (no crutch): the correct option is present up front.
    await fireEvent.click(pickButton(container, answer));
    expect(get(challenge).status).toBe('answered');
    expect(get(challenge).feedback!.correct).toBe(true);
    expect(get(challenge).state!.cleared).toBe(1);
  });

  it('a single miss ends the run and hands a failed summary to the Summary route', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      stage();
      const { container } = render(Challenge);
      const q = get(challenge).question!;
      const wrong = q.options!.find((c) => c.iso2 !== q.answer.iso2)!.iso2;
      await fireEvent.click(pickButton(container, wrong));
      expect(get(challenge).feedback!.correct).toBe(false);

      // The fatal-miss dwell then finalizes: a challenge SessionSummary + the rich failed summary.
      await vi.advanceTimersByTimeAsync(REVEAL_MS + 100);
      const rich = get(lastChallengeSummary);
      expect(rich?.passed).toBe(false);
      expect(rich?.missed?.iso2).toBe(q.answer.iso2);
      expect(get(lastSummary)?.type).toBe('challenge');
    } finally {
      vi.useRealTimers();
    }
  });

  it('quit abandons the run (no summary handed off) and returns to idle', async () => {
    stage();
    render(Challenge);
    await fireEvent.click(screen.getByText('Quit run'));
    expect(get(challenge).status).toBe('idle');
    // A quit is not a result — nothing is staged for the Summary.
    expect(get(lastChallengeSummary)).toBeNull();
  });
});
