import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Progress from './Progress.svelte';
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
    choices: 4,
    missed: [],
    results: [
      { itemKey: 'flag-to-country:BG', countryIso2: 'BG', correct: true, answerMs: 500 },
      { itemKey: 'flag-to-country:FR', countryIso2: 'FR', correct: false, answerMs: 900 },
    ],
    ...over,
  };
}

describe('Progress route (learning & achievements)', () => {
  beforeAll(async () => {
    setLocale('en');
    await initPersistence();
  });

  beforeEach(async () => {
    setLocale('en');
    await clearHistory();
  });

  it('shows the empty state when nothing has been played', async () => {
    render(Progress);
    expect(await screen.findByText(/No progress yet/i, {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('renders the overview tiles and world mastery after a session is saved', async () => {
    await saveSession(summary());
    render(Progress);

    // "World mastery" appears twice (panel heading + the meter's own title).
    expect(
      (await screen.findAllByText('World mastery', {}, { timeout: 3000 })).length,
    ).toBeGreaterThan(0);
    // Overview tiles moved here from History (the "Time played" tile is unique to them).
    expect(screen.getByText('Time played')).toBeInTheDocument();

    // The activity log lives on the History page — not here.
    expect(screen.queryByText('Most-missed countries')).not.toBeInTheDocument();
    expect(screen.queryByText('Recent sessions')).not.toBeInTheDocument();
    expect(screen.queryByText('Sessions per day')).not.toBeInTheDocument();
  });

  it('renders the self row on the progress board (from local stats) after a session', async () => {
    await saveSession(summary());
    render(Progress);

    // The board panel + the empty-state that names the friends coming in Phase 53.
    expect(await screen.findByText('Your board', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/Friends will show up here/i)).toBeInTheDocument();
    // With no display name set, the self row is labelled "You".
    expect(screen.getByText('You')).toBeInTheDocument();
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
    render(Progress);

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
    render(Progress);

    expect(await screen.findByText('Extra knowledge', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getAllByText('Languages').length).toBeGreaterThan(0);
  });
});
