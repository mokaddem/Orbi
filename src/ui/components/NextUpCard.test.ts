import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import type { Recommendation } from '../../domain';

// Capture navigation without a mounted router.
const push = vi.fn();
vi.mock('svelte-spa-router', () => ({ push: (...args: unknown[]) => push(...args) }));

import NextUpCard from './NextUpCard.svelte';
import { pendingConfig } from '../stores/game';
import { prefs } from '../stores/persistence';
import { setLocale } from '../../i18n';

beforeEach(() => {
  setLocale('en');
  push.mockClear();
  pendingConfig.set(null);
  prefs.set({
    language: 'en',
    survivalLives: 5,
    fixedLength: 12,
    choicesPerQuestion: 4,
    mapProjection: 'naturalEarth',
    reduceMotion: false,
    sound: true,
  });
});
afterEach(() => setLocale('en'));

describe('NextUpCard', () => {
  it('renders a region-scoped due review and stages a training config on start', async () => {
    const rec: Recommendation = {
      kind: 'due',
      mode: 'flag-to-country',
      regionKey: 'Europe',
      count: 2,
      run: { mode: 'flag-to-country', type: 'training', answerPoolIso: ['BG', 'RO'] },
    };
    render(NextUpCard, { rec });

    expect(screen.getByTestId('next-up-card')).toHaveAttribute('data-kind', 'due');
    expect(screen.getByRole('heading')).toHaveTextContent('Time to review');
    expect(screen.getByText('2 to review in Europe — weakest first.')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(push).toHaveBeenCalledWith('/play');
    expect(get(pendingConfig)).toEqual({
      mode: 'flag-to-country',
      type: 'training',
      answerPoolIso: ['BG', 'RO'],
      fixedLength: 2,
      choices: 4,
    });
  });

  it('renders the fresh-start fallback and clears any staged config on start (opens setup)', async () => {
    pendingConfig.set({ mode: 'flag-to-country', type: 'fixed' }); // a stale config to be cleared
    const rec: Recommendation = { kind: 'fresh-start' };
    render(NextUpCard, { rec });

    expect(screen.getByRole('heading')).toHaveTextContent('Ready to play');

    await fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(push).toHaveBeenCalledWith('/play');
    expect(get(pendingConfig)).toBeNull();
  });

  it('translates to French at runtime', () => {
    setLocale('fr');
    const rec: Recommendation = {
      kind: 'due',
      mode: 'flag-to-country',
      regionKey: 'Europe',
      count: 3,
      run: { mode: 'flag-to-country', type: 'training', answerPoolIso: ['BG', 'RO', 'FR'] },
    };
    render(NextUpCard, { rec });
    expect(screen.getByRole('heading')).toHaveTextContent("C'est l'heure de réviser");
  });
});
