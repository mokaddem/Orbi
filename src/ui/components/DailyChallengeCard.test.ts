import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { buildDailyChallenge, DAILY_CHOICES } from '../../domain';
import type { DailyResult } from '../../data';

// Capture navigation without a mounted router.
const push = vi.fn();
vi.mock('svelte-spa-router', () => ({ push: (...args: unknown[]) => push(...args) }));

import DailyChallengeCard from './DailyChallengeCard.svelte';
import { pendingConfig } from '../stores/game';
import { setLocale } from '../../i18n';

const DATE = '2026-07-08';
const challenge = buildDailyChallenge(DATE);

beforeEach(() => {
  setLocale('en');
  push.mockClear();
  pendingConfig.set(null);
});
afterEach(() => setLocale('en'));

describe('DailyChallengeCard', () => {
  it('renders the challenge and stages a date-seeded fixed config on start', async () => {
    render(DailyChallengeCard, { challenge });

    const card = screen.getByTestId('daily-card');
    expect(card).toHaveAttribute('data-done', 'false');
    expect(screen.getByText('Daily Challenge')).toBeInTheDocument();
    expect(screen.getByRole('heading')).toHaveTextContent("Today's Challenge");

    await fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(push).toHaveBeenCalledWith('/play');

    const cfg = get(pendingConfig);
    expect(cfg).toMatchObject({
      mode: challenge.mode,
      type: 'fixed',
      fixedLength: challenge.length,
      choices: DAILY_CHOICES,
      dailyDate: DATE,
    });
    // The region theme (or absence of one) is carried verbatim onto the run.
    expect(cfg!.filter).toEqual(challenge.filter);
    // A seeded RNG is the production mechanism that makes the day's questions reproducible.
    expect(typeof cfg!.rng).toBe('function');
  });

  it('shows a completed state with the score when done today', () => {
    const result: DailyResult = {
      date: DATE,
      completed: true,
      total: 10,
      correct: 7,
      mode: challenge.mode,
    };
    render(DailyChallengeCard, { challenge, done: true, result });

    expect(screen.getByTestId('daily-card')).toHaveAttribute('data-done', 'true');
    expect(screen.getByText('Done for today ✓')).toBeInTheDocument();
    expect(screen.getByText('You scored 7/10')).toBeInTheDocument();
    // A replay is still offered (practice — it doesn't un-complete the day).
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument();
  });

  it('translates to French at runtime', () => {
    setLocale('fr');
    render(DailyChallengeCard, { challenge });
    expect(screen.getByText('Défi du jour')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jouer' })).toBeInTheDocument();
  });
});
