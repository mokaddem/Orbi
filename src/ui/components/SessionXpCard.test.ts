import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SessionXpCard from './SessionXpCard.svelte';
import { rankForXp, sessionXp, sessionXpBreakdown, type QuestionResult } from '../../domain';
import { setLocale } from '../../i18n';

beforeEach(() => setLocale('en'));
afterEach(() => setLocale('en'));

// A stub IntersectionObserver that reports the card at a fixed visibility `ratio` the instant it's
// observed, so the reveal-gated tally runs under jsdom (which has no real IntersectionObserver). Its
// mere presence also flips the component's `canAnimate` on. ratio ≥ 0.99 = the whole card on screen
// (the tally starts immediately); 0.5–0.99 = only partly on screen (it holds ~3s first).
function fixedIO(ratio: number) {
  return class {
    private cb: IntersectionObserverCallback;
    root = null;
    rootMargin = '';
    thresholds: number[] = [];
    constructor(cb: IntersectionObserverCallback) {
      this.cb = cb;
    }
    observe(): void {
      this.cb(
        [{ isIntersecting: ratio >= 0.5, intersectionRatio: ratio } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    }
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  };
}

function results(n: number, correct: number): QuestionResult[] {
  return Array.from({ length: n }, (_, i) => ({
    itemKey: `flag-to-country:C${i}`,
    countryIso2: `C${i}`,
    correct: i < correct,
    answerMs: 1000,
  }));
}

describe('SessionXpCard', () => {
  it('shows the "+N XP" earned and itemizes the run by source (incl. the streak bonus)', () => {
    // 12 correct in a row → 12·10 + 12·3 + 25 + 50 (streak, crossing 3·5·10) = 231 XP.
    const run = results(12, 12);
    const earned = sessionXp(run);
    render(SessionXpCard, {
      earned,
      breakdown: sessionXpBreakdown(run),
      progress: rankForXp(earned),
      startFraction: 0,
    });

    expect(earned).toBe(231);
    expect(screen.getByTestId('xp-earned')).toHaveTextContent('+231 XP');
    // The source rows, with the session bonus relabelled (not "Sessions played").
    expect(screen.getByText('Correct answers')).toBeInTheDocument();
    expect(screen.getByText('Questions answered')).toBeInTheDocument();
    expect(screen.getByText('Session bonus')).toBeInTheDocument();
    expect(screen.getByText('Streak milestones')).toBeInTheDocument();
    expect(screen.queryByText('Sessions played')).not.toBeInTheDocument();
    // The per-row XP amounts sum to the headline.
    expect(screen.getByText('+120 XP')).toBeInTheDocument();
    expect(screen.getByText('+36 XP')).toBeInTheDocument();
    expect(screen.getByText('+25 XP')).toBeInTheDocument();
    expect(screen.getByText('+50 XP')).toBeInTheDocument();
  });

  it('renders the rank progress bar reporting the current fill, and the total XP', () => {
    // 600 XP → Scout (400 ≤ 600 < 1000 Wanderer); 200 into the 600-wide band → 33%.
    const progress = rankForXp(600);
    render(SessionXpCard, { earned: 100, breakdown: sessionXpBreakdown(results(5, 5)), progress });

    expect(screen.getByText('Scout')).toBeInTheDocument();
    expect(screen.getByText('600 XP total')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
    expect(screen.getByText(/to Wanderer/)).toBeInTheDocument();
  });

  it('drops the "correct" row when the run had no correct answers', () => {
    render(SessionXpCard, {
      earned: 34,
      breakdown: sessionXpBreakdown(results(3, 0)),
      progress: null,
    });
    expect(screen.queryByText('Correct answers')).not.toBeInTheDocument();
    expect(screen.getByText('Questions answered')).toBeInTheDocument();
    expect(screen.getByText('Session bonus')).toBeInTheDocument();
  });

  it('renders the earned breakdown even before the rank snapshot is available', () => {
    render(SessionXpCard, {
      earned: 44,
      breakdown: sessionXpBreakdown(results(3, 1)),
      progress: null,
    });
    expect(screen.getByTestId('xp-earned')).toHaveTextContent('+44 XP');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  // Level-up animation (the behaviour this test pins): when a run crosses a rank threshold, the card
  // *opens on the rank the player was already at* with the bar near the top of that rank, and rolls
  // over — resetting the bar and swapping the badge/name — the MOMENT the accumulating XP crosses the
  // threshold, then keeps filling the earned rank. It must NOT defer the roll-over to the end of the
  // tally (nor jump straight to the earned rank at the start).
  it('rolls over to the earned rank the instant the counting XP crosses the threshold', async () => {
    // rAF drives the count-up (and thus the live roll-over), so fake it alongside the timers.
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
      ],
    });
    vi.stubGlobal('IntersectionObserver', fixedIO(1)); // whole card on screen → tally starts at once
    // The burst fires the confetti canvas; jsdom has no 2D context (the component already no-ops on a
    // null ctx). Return null explicitly so it doesn't log "Not implemented: getContext" noise.
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    try {
      // Player sits deep in Wanderer, a hair short of Pathfinder's 2200-XP floor.
      const beforeXp = 2100;
      const start = rankForXp(beforeXp);
      expect(start.rank.key).toBe('wanderer');

      // A won game: a flawless 12/12 run earns +231 XP, tipping the total over 2200 into Pathfinder —
      // and the very first source row (+120 correct) alone already crosses it.
      const run = results(12, 12);
      const earned = sessionXp(run);
      const after = rankForXp(beforeXp + earned);
      expect(earned).toBe(231);
      expect(after.rank.key).toBe('pathfinder');

      render(SessionXpCard, {
        earned,
        breakdown: sessionXpBreakdown(run),
        progress: after, // the post-run snapshot (the earned rank)
        startProgress: start, // …and the rank the player was at before the run
        startFraction: start.fraction, // what Summary reconstructs for a threshold-crossing run
        rankedUp: true,
      });

      // At the *start* the card shows the CURRENT rank (Wanderer), bar near the top of that rank —
      // not the earned rank reset to near-empty.
      expect(screen.getByText('Wanderer')).toBeInTheDocument();
      expect(screen.queryByText('Pathfinder')).not.toBeInTheDocument();
      const valueAtStart = Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));
      expect(valueAtStart).toBeGreaterThan(50); // ~92% into Wanderer

      // A moment into the first row (+120 correct) the counting XP tips over 2200 → the LEVEL-UP BEAT:
      // the bar completes to the top of Wanderer and holds there for ~600ms (still Wanderer, bar full)
      // before popping over.
      await vi.advanceTimersByTimeAsync(400);
      expect(screen.getByText('Wanderer')).toBeInTheDocument();
      expect(screen.queryByText('Pathfinder')).not.toBeInTheDocument();
      expect(Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'))).toBe(100);

      // After the beat it pops over to Pathfinder, bar reset low into the new rank — still well before
      // the last row lands.
      await vi.advanceTimersByTimeAsync(1200);
      expect(screen.getByText('Pathfinder')).toBeInTheDocument();
      expect(screen.queryByText('Wanderer')).not.toBeInTheDocument();
      expect(Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'))).toBeLessThan(
        valueAtStart,
      ); // reset + regrowing within Pathfinder

      // …and it stays on the earned rank through the rest of the tally.
      await vi.advanceTimersByTimeAsync(8000);
      expect(screen.getByText('Pathfinder')).toBeInTheDocument();
      expect(screen.queryByText('Wanderer')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      getContext.mockRestore();
    }
  });

  // Reveal timing: the tally holds ~3s once the card is only partly on screen, but starts right
  // away when the whole card (its bottom edge) is on screen.
  it('starts the XP tally immediately when the whole card is on screen', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.stubGlobal('IntersectionObserver', fixedIO(1)); // fully on screen
    try {
      const run = results(5, 5);
      const { container } = render(SessionXpCard, {
        earned: sessionXp(run),
        breakdown: sessionXpBreakdown(run),
        progress: rankForXp(600),
      });
      // Well before the 3s hold, the first source row has already landed.
      await vi.advanceTimersByTimeAsync(50);
      expect(container.querySelectorAll('.src-row.shown').length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('holds ~3s before the tally when the card is only partly on screen', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.stubGlobal('IntersectionObserver', fixedIO(0.5)); // half on screen
    try {
      const run = results(5, 5);
      const { container } = render(SessionXpCard, {
        earned: sessionXp(run),
        breakdown: sessionXpBreakdown(run),
        progress: rankForXp(600),
      });
      // Still within the hold — nothing has landed yet.
      await vi.advanceTimersByTimeAsync(1000);
      expect(container.querySelectorAll('.src-row.shown').length).toBe(0);
      // Past the 3s hold — the tally has begun.
      await vi.advanceTimersByTimeAsync(2600);
      expect(container.querySelectorAll('.src-row.shown').length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
