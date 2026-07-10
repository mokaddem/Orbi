import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import type { RegionReview } from '../../domain';

// Capture navigation without a mounted router.
const push = vi.fn();
vi.mock('svelte-spa-router', () => ({ push: (...args: unknown[]) => push(...args) }));

import ReviewByRegion from './ReviewByRegion.svelte';
import { pendingConfig } from '../stores/game';
import { prefs } from '../stores/persistence';
import { setLocale } from '../../i18n';

const REVIEWS: RegionReview[] = [
  { region: 'Europe', mode: 'flag-to-country', iso2s: ['BG', 'RO'], due: 2, total: 2 },
  { region: 'Asia', mode: 'map-highlight', iso2s: ['JP'], due: 1, total: 1 },
];
const PLAN = { mode: 'flag-to-country' as const, iso2s: ['BG', 'RO', 'JP'] };

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
  });
});
afterEach(() => setLocale('en'));

describe('ReviewByRegion', () => {
  it('lists regions most-urgent-first, pre-selecting the top one', () => {
    render(ReviewByRegion, { reviews: REVIEWS, plan: PLAN });

    expect(screen.getByRole('heading', { name: 'Time to review' })).toBeInTheDocument();
    const europe = screen.getByRole('button', { name: /Europe/ });
    const asia = screen.getByRole('button', { name: /Asia/ });
    expect(europe).toHaveTextContent('2 to review');
    expect(asia).toHaveTextContent('1 to review');
    // The most-urgent region is visually pre-selected (primary).
    expect(europe).toHaveClass('primary');
    expect(asia).not.toHaveClass('primary');
  });

  it('stages a region-scoped training run on tap (no foreign-region items)', async () => {
    render(ReviewByRegion, { reviews: REVIEWS, plan: PLAN });

    await fireEvent.click(screen.getByRole('button', { name: /Asia/ }));
    expect(push).toHaveBeenCalledWith('/play');
    expect(get(pendingConfig)).toEqual({
      mode: 'map-highlight',
      type: 'training',
      answerPoolIso: ['JP'],
      fixedLength: 1,
      choices: 4,
    });
  });

  it('offers a "review everything" escape hatch backed by the global plan', async () => {
    render(ReviewByRegion, { reviews: REVIEWS, plan: PLAN });

    const everything = screen.getByRole('button', { name: /Review everything \(3\)/ });
    await fireEvent.click(everything);
    expect(get(pendingConfig)).toEqual({
      mode: 'flag-to-country',
      type: 'training',
      answerPoolIso: ['BG', 'RO', 'JP'],
      fixedLength: 3,
      choices: 4,
    });
  });

  it('omits the escape hatch when there is no global plan', () => {
    render(ReviewByRegion, { reviews: REVIEWS, plan: null });
    expect(screen.queryByRole('button', { name: /Review everything/ })).not.toBeInTheDocument();
  });

  it('localizes region names (FR)', () => {
    setLocale('fr');
    render(ReviewByRegion, {
      reviews: [{ region: 'Africa', mode: 'flag-to-country', iso2s: ['NG'], due: 1, total: 1 }],
      plan: null,
    });
    expect(screen.getByRole('heading', { name: "C'est l'heure de réviser" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Afrique/ })).toBeInTheDocument();
  });
});
