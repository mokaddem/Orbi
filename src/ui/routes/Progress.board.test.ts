import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { readable } from 'svelte/store';

// Phase 53: with a backend + an account + a friend in the store, the Progress board renders self +
// friend rows (sorted XP desc) and the "invite a friend" action. We mock the friends store, identity,
// and backend config so the component renders the friend path without a live server.
vi.mock('../../backend/client', () => ({ isBackendConfigured: () => true }));
vi.mock('../stores/identity', () => ({
  identity: readable({
    deviceId: 'd',
    displayName: 'Me',
    tier: 'account',
    email: 'me@example.com',
    sync: 'synced',
  }),
}));
vi.mock('../stores/friends', () => ({
  friends: readable([
    {
      userId: 'fr1',
      displayName: 'Bob',
      xp: 40_000,
      rankIndex: 4,
      fullyMastered: 20,
      sessionCount: 12,
    },
  ]),
  refreshFriends: vi.fn(),
  unfriend: vi.fn(),
  myUserId: vi.fn().mockResolvedValue('me'),
}));

import Progress from './Progress.svelte';
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
    choices: 4,
    missed: [],
    results: [
      { itemKey: 'flag-to-country:BG', countryIso2: 'BG', correct: true, answerMs: 500 },
      { itemKey: 'flag-to-country:FR', countryIso2: 'FR', correct: false, answerMs: 900 },
    ],
    ...over,
  };
}

describe('Progress board with friends (Phase 53)', () => {
  beforeAll(async () => {
    setLocale('en');
    await initPersistence();
  });

  beforeEach(async () => {
    setLocale('en');
    await clearHistory();
  });

  it('renders self + a friend row and the invite action for an account holder', async () => {
    await saveSession(summary());
    render(Progress);

    // The board panel, the friend's name, and the self label are all present.
    expect(await screen.findByText('Your board', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
    // Account holder with a friend → the "invite a friend" CTA, not the account gate.
    expect(screen.getByText('Invite a friend')).toBeInTheDocument();
    expect(screen.queryByText('Create an account')).not.toBeInTheDocument();
    // The friend's high XP renders (sorted above the fresh self row).
    expect(screen.getByText((_, el) => el?.textContent === '40,000XP')).toBeInTheDocument();
  });
});
