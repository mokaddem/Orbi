import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Challenge from './Challenge.svelte';
import { challenge, pendingChallenge } from '../stores/challenge';
import { prefs } from '../stores/persistence';
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

// Fatal-miss dwell before the run finalizes to the in-arena runover (mirrors Challenge.svelte).
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
  // Default the arena to full-motion (the intro plays); the reduce-motion case sets it explicitly.
  prefs.update((p) => ({ ...p, reduceMotion: false }));
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
    // Both directions of every eligible country → 2 × N slots. The arena HUD (Phase 45) shows the
    // gold cleared/total counter (its accessible label carries the full "cleared" phrasing) and the
    // single life as a beating heart (titled "One life").
    expect(screen.getByLabelText(new RegExp(`0 / ${total} cleared`))).toBeInTheDocument();
    expect(screen.getByTitle('One life')).toBeInTheDocument();
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

  it('a single miss ends the run in the in-arena runover (no /summary route)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      stage();
      const { container } = render(Challenge);
      const q = get(challenge).question!;
      const wrong = q.options!.find((c) => c.iso2 !== q.answer.iso2)!.iso2;
      await fireEvent.click(pickButton(container, wrong));
      expect(get(challenge).feedback!.correct).toBe(false);

      // The fatal-miss dwell then finalizes to the in-arena runover, naming the country it died on.
      await vi.advanceTimersByTimeAsync(REVEAL_MS + 100);
      expect(screen.getByText('The challenge ends here')).toBeInTheDocument();
      expect(container.querySelector('.runover-missed')?.textContent).toContain(q.answer.name.en);
    } finally {
      vi.useRealTimers();
    }
  });

  it('forfeit is guarded, then ends the run as a failed attempt with the game-over screen', async () => {
    stage();
    render(Challenge);
    // Tapping Forfeit opens the guard confirm — the run is still live, not ended.
    await fireEvent.click(screen.getByRole('button', { name: 'Forfeit' }));
    expect(get(challenge).status).toBe('playing');
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Forfeit the challenge?');
    // Confirming forfeits: the run finishes as a failure and the in-arena runover ("game over") shows.
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Forfeit' }));
    expect(get(challenge).status).toBe('finished');
    expect(screen.getByText('The challenge ends here')).toBeInTheDocument();
  });

  it('cancelling the forfeit confirm keeps the run going', async () => {
    stage();
    render(Challenge);
    await fireEvent.click(screen.getByRole('button', { name: 'Forfeit' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Keep going' }));
    // The guard is dismissed and the run is untouched — no end screen.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(get(challenge).status).toBe('playing');
    expect(screen.queryByText('The challenge ends here')).not.toBeInTheDocument();
  });
});

describe('Challenge cinematic entry (Phase 45)', () => {
  it('blooms the intro title on a fresh run, then reveals the HUD', async () => {
    vi.useFakeTimers();
    try {
      stage();
      render(Challenge);
      // The ceremonial title blooms first (over the dimmed arena)…
      expect(screen.getByText('Enter the Gauntlet')).toBeInTheDocument();
      // …then the intro crossfades out (hold 1900ms + fade 600ms) and the HUD takes over.
      await vi.advanceTimersByTimeAsync(1900 + 600 + 100);
      expect(screen.queryByText('Enter the Gauntlet')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips the intro under reduce-motion (the Enter cue still plays)', () => {
    prefs.update((p) => ({ ...p, reduceMotion: true }));
    stage();
    render(Challenge);
    // No visual transition — the HUD is live immediately…
    expect(screen.queryByText('Enter the Gauntlet')).not.toBeInTheDocument();
    // …but the audio cue is not motion, so it still fires.
    expect(soundMock.play).toHaveBeenCalledWith('enter');
  });
});

describe('Challenge in-arena end screens (Phase 45 ④)', () => {
  /** Clear the whole board with correct picks (fake timers must be active). */
  async function clearBoard(container: HTMLElement): Promise<void> {
    for (let guard = 0; guard < 200; guard += 1) {
      const v = get(challenge);
      if (v.status === 'finished' || v.status === 'idle') break;
      if (v.status === 'playing' && v.question) {
        await fireEvent.click(pickButton(container, v.question.answer.iso2));
      }
      await vi.advanceTimersByTimeAsync(CORRECT_MS + 100);
    }
  }

  it('victory bloom: Onward resets the run and leaves the arena', async () => {
    vi.useFakeTimers();
    try {
      stage();
      const { container } = render(Challenge);
      await clearBoard(container);
      expect(screen.getByText('GRANDMASTER')).toBeInTheDocument();
      // The victory CTA is "Onward" (not the runover screen's anticlimactic "Return").
      await fireEvent.click(screen.getByText('Onward'));
      expect(get(challenge).status).toBe('idle');
    } finally {
      vi.useRealTimers();
    }
  });

  it('runover: reports how far the run got', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      stage();
      const { container } = render(Challenge);
      const total = get(challenge).state!.total;
      const q = get(challenge).question!;
      const wrong = q.options!.find((c) => c.iso2 !== q.answer.iso2)!.iso2;
      await fireEvent.click(pickButton(container, wrong)); // miss the very first slot
      await vi.advanceTimersByTimeAsync(REVEAL_MS + 100);
      // Cleared 0 of N (the first pick missed), shown in the runover body.
      expect(screen.getByText(new RegExp(`0 of ${total}`))).toBeInTheDocument();
      await fireEvent.click(screen.getByText('Return'));
      expect(get(challenge).status).toBe('idle');
    } finally {
      vi.useRealTimers();
    }
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

  it('stops the bed when the run is forfeited', async () => {
    stage();
    render(Challenge);
    await fireEvent.click(screen.getByRole('button', { name: 'Forfeit' }));
    await fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Forfeit' }),
    );
    expect(soundMock.stopBed).toHaveBeenCalled();
  });

  it('crowns a clean sweep with the Victory fanfare + in-arena bloom, and stops the bed', async () => {
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
      // The in-arena victory bloom shows (no /summary route), with the Victory fanfare.
      expect(screen.getByText('GRANDMASTER')).toBeInTheDocument();
      expect(soundMock.play).toHaveBeenCalledWith('victory');
      expect(soundMock.play).not.toHaveBeenCalledWith('perfect'); // the old cue is replaced
      expect(soundMock.stopBed).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
