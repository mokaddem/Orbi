import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Summary from './Summary.svelte';
import { lastBlitzResult, lastSummary, pendingConfig, play } from '../stores/game';
import { getCountry } from '../../data';
import type { GameMode, SessionSummary, SessionType } from '../../domain';
import { setLocale } from '../../i18n';

const bg = getCountry('BG')!;
const ro = getCountry('RO')!;

function summary(over: Partial<SessionSummary> = {}): SessionSummary {
  const mode: GameMode = over.mode ?? 'map-highlight';
  const missed = over.missed ?? [];
  return {
    mode,
    type: (over.type ?? 'fixed') as SessionType,
    total: 3,
    correct: 1,
    accuracy: 1 / 3,
    bestStreak: 1,
    startedAt: 1000,
    finishedAt: 4000,
    durationMs: 3000,
    missed,
    results: [
      { itemKey: `${mode}:BG`, countryIso2: 'BG', correct: false, answerMs: 900 },
      { itemKey: `${mode}:RO`, countryIso2: 'RO', correct: false, answerMs: 800 },
      { itemKey: `${mode}:FR`, countryIso2: 'FR', correct: true, answerMs: 500 },
    ],
    ...over,
  };
}

beforeEach(() => {
  setLocale('en');
  play.reset();
  pendingConfig.set(null);
});

afterEach(() => {
  play.reset();
  lastSummary.set(null);
  lastBlitzResult.set(null);
  pendingConfig.set(null);
});

describe('Summary route — Explorer XP (Phase 43)', () => {
  it('shows the play-derived "+N XP" earned this run, itemized by source', () => {
    // 3 questions, 1 correct → 1·10 + 3·3 + 25 (session) = 44 XP.
    lastSummary.set(summary({ mode: 'flag-to-country' }));
    render(Summary);
    expect(screen.getByTestId('xp-earned')).toHaveTextContent('+44 XP');
    // The XP card itemizes the run: correct answers, questions, and the session bonus.
    expect(screen.getByTestId('session-xp-card')).toBeInTheDocument();
    expect(screen.getByText('Correct answers')).toBeInTheDocument();
    expect(screen.getByText('Questions answered')).toBeInTheDocument();
    expect(screen.getByText('Session bonus')).toBeInTheDocument();
  });
});

describe('Summary route — Train these', () => {
  it('enables "Train these" and stages a training session over the missed items', async () => {
    lastSummary.set(summary({ mode: 'map-highlight', missed: [bg, ro] }));
    render(Summary);

    const trainBtn = screen.getByRole('button', { name: 'Train these' });
    expect(trainBtn).toBeEnabled();

    await fireEvent.click(trainBtn);

    const cfg = get(pendingConfig);
    expect(cfg).toMatchObject({
      mode: 'map-highlight',
      type: 'training',
      answerPoolIso: ['BG', 'RO'],
      fixedLength: 2,
    });
  });

  it('disables "Train these" when nothing was missed', () => {
    lastSummary.set(summary({ mode: 'flag-to-country', missed: [], correct: 3, accuracy: 1 }));
    render(Summary);
    expect(screen.getByRole('button', { name: 'Train these' })).toBeDisabled();
  });

  it('retry of a training session reuses the same drilled countries', async () => {
    lastSummary.set(summary({ mode: 'flag-to-country', type: 'training', missed: [bg] }));
    render(Summary);

    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    const cfg = get(pendingConfig);
    expect(cfg).toMatchObject({ mode: 'flag-to-country', type: 'training' });
    // Every distinct country asked, not just the missed one.
    expect(cfg!.answerPoolIso?.slice().sort()).toEqual(['BG', 'FR', 'RO']);
  });
});

describe('Summary route — visual sweep imagery', () => {
  it('adds a mode glyph + region silhouette to the meta line and icons to the stat tiles', () => {
    lastSummary.set(
      summary({ mode: 'map-highlight', regionFilter: { region: 'Europe' }, missed: [bg] }),
    );
    const { container } = render(Summary);

    expect(container.querySelector('.meta .mode-icon')).toBeInTheDocument();
    expect(container.querySelector('.meta .region-icon')).toBeInTheDocument();
    // Score / accuracy / time / best-streak each carry an icon.
    expect(container.querySelectorAll('.stats .stat .icon').length).toBe(4);
  });

  it('keeps the action-button accessible names despite the added icons', () => {
    lastSummary.set(summary({ mode: 'map-highlight', missed: [bg] }));
    render(Summary);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Train these' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New game' })).toBeInTheDocument();
  });
});

describe('Summary route — Blitz result (Phase 42)', () => {
  it('shows the points score and celebrates a new personal best', () => {
    lastSummary.set(summary({ mode: 'flag-to-country', type: 'blitz' }));
    lastBlitzResult.set({ points: 1240, best: 1240, isNewBest: true });
    const { container } = render(Summary);

    expect(container.querySelector('.blitz-score')?.textContent).toContain('1,240');
    expect(screen.getByText('New personal best!')).toBeInTheDocument();
  });

  it('shows the standing personal best when it was not beaten', () => {
    lastSummary.set(summary({ mode: 'flag-to-country', type: 'blitz' }));
    lastBlitzResult.set({ points: 800, best: 1780, isNewBest: false });
    render(Summary);

    expect(screen.getByText('Personal best: 1,780')).toBeInTheDocument();
    expect(screen.queryByText('New personal best!')).not.toBeInTheDocument();
  });

  it('shows no blitz result block for a non-blitz session', () => {
    lastSummary.set(summary({ mode: 'flag-to-country', type: 'fixed' }));
    lastBlitzResult.set(null);
    const { container } = render(Summary);
    expect(container.querySelector('.blitz-result')).not.toBeInTheDocument();
  });
});
