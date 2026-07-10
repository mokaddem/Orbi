import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import History from './History.svelte';
import { setLocale } from '../../i18n';
import { clearHistory, initPersistence, recordAnswer, saveSession } from '../stores/persistence';
import type { SessionSummary } from '../../domain';

function summary(over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    mode: 'flag-to-country',
    type: 'fixed',
    total: 2,
    correct: 1,
    accuracy: 0.5,
    bestStreak: 1,
    startedAt: Date.UTC(2026, 6, 7, 10, 0, 0),
    finishedAt: Date.UTC(2026, 6, 7, 10, 1, 0),
    durationMs: 60_000,
    missed: [],
    results: [
      { itemKey: 'flag-to-country:BG', countryIso2: 'BG', correct: true, answerMs: 500 },
      { itemKey: 'flag-to-country:FR', countryIso2: 'FR', correct: false, answerMs: 900 },
    ],
    ...over,
  };
}

describe('History route', () => {
  beforeAll(async () => {
    setLocale('en');
    await initPersistence();
  });

  beforeEach(async () => {
    setLocale('en');
    await clearHistory();
  });

  it('shows the empty state when nothing has been played', async () => {
    render(History);
    expect(await screen.findByText(/No sessions yet/i, {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('renders stats and the most-missed country after a session is saved', async () => {
    await saveSession(summary());
    render(History);

    // Overview + most-missed surface the persisted session.
    expect(
      await screen.findByText('Most-missed countries', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('France')).toBeInTheDocument();
    expect(screen.getByText('Sessions per day')).toBeInTheDocument();
    expect(screen.getByText('Recent sessions')).toBeInTheDocument();
    // No capitals / languages played → the combined "extra knowledge" panel stays hidden.
    expect(screen.queryByText('Extra knowledge')).not.toBeInTheDocument();
  });

  it('reveals the combined extra-knowledge panel with a Capitals meter once capitals are played', async () => {
    await saveSession(summary());
    // A capital-mode answer creates capital SR state, which drives the combined panel.
    await recordAnswer({
      itemKey: 'capital-to-country:FR',
      countryIso2: 'FR',
      correct: true,
      answerMs: 700,
    });
    render(History);

    expect(await screen.findByText('Extra knowledge', {}, { timeout: 3000 })).toBeInTheDocument();
    // The capitals topic meter appears inside it; country "World mastery" is always present.
    expect(screen.getAllByText('Capitals').length).toBeGreaterThan(0);
    expect(screen.getAllByText('World mastery').length).toBeGreaterThan(0);
  });

  it('adds a Languages meter to the extra-knowledge panel once the languages mode is played', async () => {
    await saveSession(summary());
    await recordAnswer({
      itemKey: 'country-to-languages:FR',
      countryIso2: 'FR',
      correct: true,
      answerMs: 700,
    });
    render(History);

    expect(await screen.findByText('Extra knowledge', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getAllByText('Languages').length).toBeGreaterThan(0);
  });
});
