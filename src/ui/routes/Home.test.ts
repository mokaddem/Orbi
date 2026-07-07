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

describe('Home route — Train my mistakes', () => {
  // Runs first, before any SR items are seeded, so the store has nothing to train.
  it('shows a disabled train entry with a hint when there is nothing to train', async () => {
    render(Home);
    const btn = await screen.findByRole('button', { name: 'Train my mistakes' });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/Training drills the countries you get wrong/)).toBeInTheDocument();
  });

  it('enables the entry once mistakes exist and stages a training session', async () => {
    // Record a couple of missed map-highlight items so a plan exists.
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

    // The effect loads the plan asynchronously; wait for the count to appear.
    const btn = await screen.findByRole('button', { name: /Train my mistakes \(\d+\)/ });
    expect(btn).toBeEnabled();

    await fireEvent.click(btn);

    const cfg = get(pendingConfig);
    expect(cfg).toMatchObject({ mode: 'map-highlight', type: 'training' });
    expect(cfg!.answerPoolIso?.slice().sort()).toEqual(['BG', 'RO']);
    expect(cfg!.fixedLength).toBe(2);
  });
});
