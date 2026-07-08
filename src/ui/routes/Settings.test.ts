import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import Settings from './Settings.svelte';
import { setLocale } from '../../i18n';
import {
  initPersistence,
  clearHistory,
  clearTraining,
  hasSessions,
  hasTrainingData,
  recordAnswer,
  saveSession,
} from '../stores/persistence';
import type { SessionSummary } from '../../domain';

function summary(over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    mode: 'flag-to-country',
    type: 'fixed',
    total: 1,
    correct: 1,
    accuracy: 1,
    bestStreak: 1,
    startedAt: Date.UTC(2026, 6, 7, 10, 0, 0),
    finishedAt: Date.UTC(2026, 6, 7, 10, 1, 0),
    durationMs: 60_000,
    missed: [],
    results: [{ itemKey: 'flag-to-country:BG', countryIso2: 'BG', correct: true, answerMs: 500 }],
    ...over,
  };
}

const missedAnswer = {
  itemKey: 'map-highlight:BG',
  countryIso2: 'BG',
  correct: false,
  answerMs: 700,
} as const;

describe('Settings — Data resets', () => {
  beforeAll(async () => {
    await initPersistence();
  });

  beforeEach(async () => {
    setLocale('en');
    await clearHistory();
    await clearTraining();
  });

  it('disables both reset controls when there is no data', async () => {
    render(Settings);
    const clearBtn = await screen.findByRole('button', { name: 'Clear history' });
    const resetBtn = screen.getByRole('button', { name: 'Reset training' });
    // The availability effect resolves asynchronously; both should settle disabled.
    await waitFor(() => expect(clearBtn).toBeDisabled());
    expect(resetBtn).toBeDisabled();
  });

  it('resets training via the confirmation dialog, then disables the control', async () => {
    await recordAnswer(missedAnswer);
    render(Settings);

    const resetBtn = await screen.findByRole('button', { name: 'Reset training' });
    await waitFor(() => expect(resetBtn).toBeEnabled());

    // No dialog until the control is clicked.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await fireEvent.click(resetBtn);

    const dialog = await screen.findByRole('dialog');
    // The confirm button (inside the dialog) carries the action label.
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Reset training' }));

    // Store is emptied and the control disables — the on-screen signal, no toast.
    await waitFor(() => expect(resetBtn).toBeDisabled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await hasTrainingData()).toBe(false);
  });

  it('cancelling keeps the training data and closes the dialog', async () => {
    await recordAnswer(missedAnswer);
    render(Settings);

    const resetBtn = await screen.findByRole('button', { name: 'Reset training' });
    await waitFor(() => expect(resetBtn).toBeEnabled());
    await fireEvent.click(resetBtn);

    const dialog = await screen.findByRole('dialog');
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await hasTrainingData()).toBe(true);
    expect(resetBtn).toBeEnabled();
  });

  it('clears history through the Settings control, leaving training intact', async () => {
    await saveSession(summary());
    await recordAnswer(missedAnswer);
    render(Settings);

    const clearBtn = await screen.findByRole('button', { name: 'Clear history' });
    await waitFor(() => expect(clearBtn).toBeEnabled());
    await fireEvent.click(clearBtn);

    const dialog = await screen.findByRole('dialog');
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Clear history' }));

    await waitFor(() => expect(clearBtn).toBeDisabled());
    expect(await hasSessions()).toBe(false);
    // A history clear must not touch training progress.
    expect(await hasTrainingData()).toBe(true);
  });
});
