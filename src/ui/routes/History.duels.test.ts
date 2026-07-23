import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

// Phase 54 follow-on — "duel a friend from a past run" on the History screen. The social stores
// (duels / friends / identity) + backend config + persistence loader are mocked so the challenge
// button + friend-picker + inbox send are tested in isolation; `buildDuelPayloadFromRecord` and the
// codec stay real, so the payload is built end-to-end from the stored record.
const h = vi.hoisted(() => {
  const mk = <T>(init: T) => {
    let v = init;
    const subs = new Set<(x: T) => void>();
    return {
      subscribe(fn: (x: T) => void) {
        subs.add(fn);
        fn(v);
        return () => void subs.delete(fn);
      },
      set(nv: T) {
        v = nv;
        subs.forEach((f) => f(v));
      },
      get: () => v,
    };
  };
  // A duel-able record: seeded, a duel format, ≥ MIN_DUEL_QUESTIONS (10), no custom pool.
  const rec = {
    id: 's1',
    startedAt: 1000,
    finishedAt: 61000,
    durationMs: 60000,
    mode: 'flag-to-country' as const,
    type: 'fixed' as const,
    regionFilter: { region: 'Europe' },
    total: 12,
    correct: 9,
    seed: 0x1234abcd,
    choices: 4,
    questions: [
      { itemKey: 'flag-to-country:BG', countryIso2: 'BG', correct: true, answerMs: 500 },
      { itemKey: 'flag-to-country:FR', countryIso2: 'FR', correct: false, answerMs: 900 },
    ],
  };
  return {
    configured: true,
    identity: mk<{ tier: string }>({ tier: 'account' }),
    friends: mk<{ userId: string; displayName: string }[]>([{ userId: 'fr1', displayName: 'Bob' }]),
    send: vi.fn<(opponentId: string, code: string, score: { primary: number }) => Promise<'ok'>>(
      async () => 'ok' as const,
    ),
    loadSessions: vi.fn(async () => [rec]),
    storageReady: mk(true),
    persistent: mk(true),
    prefs: mk<{ playerName: string; choicesPerQuestion: number }>({
      playerName: 'Me',
      choicesPerQuestion: 4,
    }),
    rec,
  };
});

vi.mock('../../backend/client', () => ({ isBackendConfigured: () => h.configured }));
vi.mock('../stores/identity', () => ({ identity: h.identity }));
vi.mock('../stores/friends', () => ({ friends: h.friends }));
vi.mock('../stores/duels', () => ({ send: h.send }));
vi.mock('../stores/board', () => ({ syncBoard: () => {} }));
vi.mock('../stores/persistence', () => ({
  loadSessions: h.loadSessions,
  clearHistory: vi.fn(async () => {}),
  storageReady: h.storageReady,
  persistent: h.persistent,
  prefs: h.prefs,
}));

import History from './History.svelte';
import { setLocale } from '../../i18n';

beforeEach(() => {
  setLocale('en');
  h.send.mockClear();
  h.friends.set([{ userId: 'fr1', displayName: 'Bob' }]);
  h.configured = true;
});

describe('History — duel a friend from a past run', () => {
  it('challenges a friend: picks from the list and sends the rebuilt seeded duel', async () => {
    render(History);
    const btn = await screen.findByRole('button', { name: 'Challenge' }, { timeout: 3000 });
    await fireEvent.click(btn);

    // The friend picker opens.
    expect(screen.getByText('Who do you want to challenge?')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: /Bob/ }));

    expect(h.send).toHaveBeenCalledTimes(1);
    const [opponentId, code, score] = h.send.mock.calls[0];
    expect(opponentId).toBe('fr1');
    expect(typeof code).toBe('string'); // a real encoded duel built from the record
    expect(score.primary).toBe(9); // fixed score = correct answers on the record
    await waitFor(() => expect(screen.getByText('Challenge sent to Bob!')).toBeInTheDocument());
  });

  it('hides the challenge button when the player has no friends to send to', async () => {
    h.friends.set([]);
    render(History);
    // The recent list still renders (a known country from the record proves it), but no Challenge.
    await screen.findByText('Recent sessions', {}, { timeout: 3000 });
    expect(screen.queryByRole('button', { name: 'Challenge' })).not.toBeInTheDocument();
  });
});
