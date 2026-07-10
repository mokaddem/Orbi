import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import History from './History.svelte';
import { setLocale } from '../../i18n';
import { clearHistory, initPersistence, saveSession } from '../stores/persistence';
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

describe('History route (activity log)', () => {
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

  it('renders the activity log (timeline, most-missed, recent) after a session is saved', async () => {
    await saveSession(summary());
    render(History);

    expect(
      await screen.findByText('Most-missed countries', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('France')).toBeInTheDocument();
    expect(screen.getByText('Sessions per day')).toBeInTheDocument();
    expect(screen.getByText('Recent sessions')).toBeInTheDocument();

    // Learning panels moved to the Progress page — History never shows them.
    expect(screen.queryByText('Extra knowledge')).not.toBeInTheDocument();
    expect(screen.queryByText('World mastery')).not.toBeInTheDocument();
    expect(screen.queryByText('Accuracy')).not.toBeInTheDocument();
  });
});
