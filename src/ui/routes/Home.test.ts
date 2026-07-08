import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, beforeEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Home from './Home.svelte';
import { pendingConfig, play } from '../stores/game';
import { initPersistence, recordAnswer } from '../stores/persistence';
import { setLocale } from '../../i18n';

beforeAll(async () => {
  await initPersistence();
});

beforeEach(() => {
  setLocale('en');
  play.reset();
  pendingConfig.set(null);
});

afterEach(() => {
  play.reset();
  pendingConfig.set(null);
});

describe('Home route — Next up card + train-all link', () => {
  // Runs first, before any SR items are seeded, so the store has nothing to train.
  it('shows the fresh-start card and no train link on an empty profile', async () => {
    render(Home);
    // The card always renders (never empty); with no data it is the fresh-start fallback.
    const card = await screen.findByTestId('next-up-card');
    expect(card).toHaveAttribute('data-kind', 'fresh-start');
    expect(screen.getByRole('heading', { name: 'Ready to play' })).toBeInTheDocument();
    // With nothing to train, the "train all my mistakes" escape hatch is absent.
    expect(screen.queryByRole('button', { name: /Train all my mistakes/ })).not.toBeInTheDocument();

    // Phase 15: with no history the streak nudges a start, and the Daily Challenge is
    // present and not-yet-done.
    const streak = await screen.findByTestId('streak-indicator');
    expect(streak).toHaveTextContent('Start a streak today');
    const daily = await screen.findByTestId('daily-card');
    expect(daily).toHaveAttribute('data-done', 'false');
  });

  it('surfaces a due-review card and a train-all link once mistakes exist', async () => {
    // Record a couple of missed map-highlight items — a miss is due immediately (interval 0).
    await recordAnswer({
      itemKey: 'map-highlight:BG',
      countryIso2: 'BG',
      correct: false,
      answerMs: 700,
    });
    await recordAnswer({
      itemKey: 'map-highlight:RO',
      countryIso2: 'RO',
      correct: false,
      answerMs: 700,
    });

    render(Home);

    // The card reflects the due reviews.
    const card = await screen.findByTestId('next-up-card');
    expect(card).toHaveAttribute('data-kind', 'due');

    // The train-all link loads asynchronously; wait for its count, then launch it.
    const link = await screen.findByRole('button', { name: /Train all my mistakes \(\d+\)/ });
    await fireEvent.click(link);

    const cfg = get(pendingConfig);
    expect(cfg).toMatchObject({ mode: 'map-highlight', type: 'training' });
    expect(cfg!.answerPoolIso?.slice().sort()).toEqual(['BG', 'RO']);
    expect(cfg!.fixedLength).toBe(2);
  });
});
