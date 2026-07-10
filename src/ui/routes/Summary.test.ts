import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Summary from './Summary.svelte';
import { lastSummary, pendingConfig, play } from '../stores/game';
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
  pendingConfig.set(null);
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
