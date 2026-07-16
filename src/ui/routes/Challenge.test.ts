import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Challenge from './Challenge.svelte';
import { challenge, pendingChallenge, lastChallengeSummary } from '../stores/challenge';
import { lastSummary, lastBlitzResult } from '../stores/game';
import { mulberry32 } from '../../domain';
import { setLocale } from '../../i18n';

// Observe the Grandmaster Challenge audio wiring without a real backend: mock the sound module so
// each trigger (Enter / bed / Settle / fatal / Surge / Victory / stop) is inspectable. bedTierFor
// (from '../sound.bed') is left real so the tier maths still drives the Surge.
const soundMock = vi.hoisted(() => ({
  play: vi.fn(),
  startBed: vi.fn(),
  setBedTier: vi.fn(),
  stopBed: vi.fn(),
  gauntletFatal: vi.fn(),
  unlock: vi.fn(),
  setEnabled: vi.fn(),
}));
vi.mock('../sound', () => ({ sound: soundMock }));

// Fatal-miss dwell before the run finalizes to the Summary (mirrors Challenge.svelte's REVEAL_MS).
const REVEAL_MS = 3200;
// Correct-clear dwell + the bed's Enter→swell delay (mirror Challenge.svelte).
const CORRECT_MS = 1200;
const BED_START_DELAY_MS = 950;

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
  Object.values(soundMock).forEach((fn) => fn.mockClear());
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

describe('Challenge audio wiring (Phase 44)', () => {
  it('sounds Enter the Arena on start, then swells the bed in after a beat', () => {
    vi.useFakeTimers();
    try {
      stage();
      render(Challenge);
      expect(soundMock.play).toHaveBeenCalledWith('enter');
      expect(soundMock.startBed).not.toHaveBeenCalled(); // deferred
      vi.advanceTimersByTime(BED_START_DELAY_MS + 20);
      expect(soundMock.startBed).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('plays the relief-tinged Settle on a correct clear (never the fatal knell)', async () => {
    stage();
    const { container } = render(Challenge);
    const answer = get(challenge).question!.answer.iso2;
    await fireEvent.click(pickButton(container, answer));
    expect(soundMock.play).toHaveBeenCalledWith('settle');
    expect(soundMock.gauntletFatal).not.toHaveBeenCalled();
  });

  it('runs the fatal-miss sequence (not a plain wrong cue) on the one miss', async () => {
    stage();
    const { container } = render(Challenge);
    const q = get(challenge).question!;
    const wrong = q.options!.find((c) => c.iso2 !== q.answer.iso2)!.iso2;
    await fireEvent.click(pickButton(container, wrong));
    expect(soundMock.gauntletFatal).toHaveBeenCalledTimes(1);
    expect(soundMock.play).not.toHaveBeenCalledWith('wrong');
    expect(soundMock.play).not.toHaveBeenCalledWith('settle');
  });

  it('a quick miss cancels the deferred bed swell-in (no bed over the death reveal)', async () => {
    vi.useFakeTimers();
    try {
      stage();
      const { container } = render(Challenge);
      const q = get(challenge).question!;
      const wrong = q.options!.find((c) => c.iso2 !== q.answer.iso2)!.iso2;
      await fireEvent.click(pickButton(container, wrong)); // miss well before the 950ms bed start
      expect(soundMock.gauntletFatal).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(BED_START_DELAY_MS + 200);
      expect(soundMock.startBed).not.toHaveBeenCalled(); // the pending swell-in was cancelled
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops the bed when the run is quit', async () => {
    stage();
    render(Challenge);
    await fireEvent.click(screen.getByText('Quit run'));
    expect(soundMock.stopBed).toHaveBeenCalled();
  });

  it('crowns a clean sweep with the Victory fanfare and stops the bed', async () => {
    vi.useFakeTimers();
    try {
      stage();
      const { container } = render(Challenge);
      // Drive correct picks until the board is cleared.
      for (let guard = 0; guard < 200; guard++) {
        const v = get(challenge);
        if (v.status === 'finished' || v.status === 'idle') break;
        if (v.status === 'playing' && v.question) {
          await fireEvent.click(pickButton(container, v.question.answer.iso2));
        }
        await vi.advanceTimersByTimeAsync(CORRECT_MS + 100);
      }
      expect(get(lastChallengeSummary)?.passed).toBe(true);
      expect(soundMock.play).toHaveBeenCalledWith('victory');
      expect(soundMock.play).not.toHaveBeenCalledWith('perfect'); // the old cue is replaced
      expect(soundMock.stopBed).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
