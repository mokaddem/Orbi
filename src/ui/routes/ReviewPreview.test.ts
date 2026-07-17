import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';

// Capture navigation without a mounted router.
const push = vi.fn();
vi.mock('svelte-spa-router', () => ({ push: (...args: unknown[]) => push(...args) }));

import ReviewPreview from './ReviewPreview.svelte';
import { pendingReview, pendingConfig } from '../stores/game';
import { prefs } from '../stores/persistence';
import { setLocale } from '../../i18n';

beforeEach(() => {
  setLocale('en');
  push.mockClear();
  pendingReview.set(null);
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

describe('ReviewPreview ("Ready to review?" study card)', () => {
  it('shows the staged review scope + the covered countries (flags family)', () => {
    // A flags review avoids the lazy map geometry — the study rows are flag + name.
    pendingReview.set({ mode: 'flag-to-country', region: 'Europe', iso2s: ['BG', 'RO'] });
    render(ReviewPreview);

    expect(screen.getByRole('heading', { name: 'Ready to review?' })).toBeInTheDocument();
    // Scope: precise mode label + region + count.
    expect(screen.getByText('Flag → Country')).toBeInTheDocument();
    expect(screen.getByText('Europe')).toBeInTheDocument();
    expect(screen.getByText('2 to review')).toBeInTheDocument();
    // The revised countries (weakest-first order).
    expect(screen.getByText('Bulgaria')).toBeInTheDocument();
    expect(screen.getByText('Romania')).toBeInTheDocument();
  });

  it('launches the identical training run on "Start review" and clears the staged selection', async () => {
    pendingReview.set({ mode: 'flag-to-country', region: 'Europe', iso2s: ['BG', 'RO'] });
    render(ReviewPreview);

    await fireEvent.click(screen.getByRole('button', { name: 'Start review' }));
    expect(push).toHaveBeenCalledWith('/play');
    expect(get(pendingConfig)).toEqual({
      mode: 'flag-to-country',
      type: 'training',
      answerPoolIso: ['BG', 'RO'],
      fixedLength: 2,
      choices: 4,
    });
    // The preview handoff is consumed so a stray re-entry doesn't relaunch it.
    expect(get(pendingReview)).toBeNull();
  });

  it('shows the "review everything" scope label when the selection has no region', () => {
    pendingReview.set({ mode: 'country-to-flag', region: null, iso2s: ['FR'] });
    render(ReviewPreview);
    expect(screen.getByText('Everywhere')).toBeInTheDocument();
    expect(screen.getByText('France')).toBeInTheDocument();
  });

  it('falls to the empty state when the staged selection resolves to no countries', () => {
    pendingReview.set({ mode: 'flag-to-country', region: 'Europe', iso2s: ['ZZ'] });
    render(ReviewPreview);
    expect(
      screen.getByRole('heading', { name: 'Nothing to review right now' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start review' })).not.toBeInTheDocument();
  });
});
