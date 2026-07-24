import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

// Phase 54 — the inbox SEND flow + finish AUTO-SUBMIT on the Summary. The social stores (duels /
// friends / identity) + backend config are mocked so the additive card + gate are tested in isolation;
// the Phase-46 link path (real game store) is untouched. (The base Summary.test.ts keeps these real, so
// its send section is simply hidden — this file drives the account+friends case.)
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
  return {
    friends: mk<{ userId: string; displayName: string }[]>([]),
    identity: mk<{ tier: string }>({ tier: 'account' }),
    pendingInboxDuelId: mk<string | null>(null),
    outbox: mk<unknown[]>([]),
    // Typed via the generic (not impl params) so `.mock.calls[0]` is a proper tuple, not `[]`.
    send: vi.fn<
      (opponentId: string, code: string, score: DuelScore, opponentName: string) => Promise<'ok'>
    >(async () => 'ok' as const),
    submit: vi.fn<(duelId: string, score: DuelScore) => Promise<'ok'>>(async () => 'ok' as const),
    configured: true,
  };
});

vi.mock('../../backend/client', () => ({ isBackendConfigured: () => h.configured }));
vi.mock('../stores/identity', () => ({ identity: h.identity }));
vi.mock('../stores/friends', () => ({ friends: h.friends }));
vi.mock('../stores/duels', () => ({
  send: h.send,
  submit: h.submit,
  pendingInboxDuelId: h.pendingInboxDuelId,
  outbox: h.outbox,
}));

import Summary from './Summary.svelte';
import { lastSummary, lastRunConfig, pendingDuel, play } from '../stores/game';
import { buildDuelPayload } from '../duel';
import {
  encodeDuel,
  type DuelScore,
  type GameMode,
  type SessionSummary,
  type SessionType,
} from '../../domain';
import { setLocale } from '../../i18n';

// A duel-able run: seeded, a duel format, ≥ MIN_DUEL_QUESTIONS (10).
function summary(over: Partial<SessionSummary> = {}): SessionSummary {
  const mode: GameMode = over.mode ?? 'flag-to-country';
  return {
    mode,
    type: (over.type ?? 'fixed') as SessionType,
    regionFilter: { region: 'Europe' },
    total: 12,
    correct: 8,
    accuracy: 8 / 12,
    bestStreak: 4,
    startedAt: 1000,
    finishedAt: 61000,
    durationMs: 60000,
    missed: [],
    results: [],
    choices: 4,
    seed: 0x1234,
    ...over,
  };
}

beforeEach(() => {
  setLocale('en');
  play.reset();
  lastRunConfig.set(null);
  pendingDuel.set(null);
  h.friends.set([]);
  h.identity.set({ tier: 'account' });
  h.pendingInboxDuelId.set(null);
  h.outbox.set([]);
  h.configured = true;
  h.send.mockClear();
  h.submit.mockClear();
});

afterEach(() => {
  play.reset();
  lastSummary.set(null);
  lastRunConfig.set(null);
  pendingDuel.set(null);
});

describe('Summary — inbox send flow (Phase 54)', () => {
  it('shows a real friend list with ≥1 friend, else a locked "add a friend" teaser', async () => {
    lastSummary.set(summary());
    h.friends.set([]);
    const { unmount } = render(Summary);
    // The card is collapsed to one button; expand it to reveal the options.
    await fireEvent.click(screen.getByRole('button', { name: 'Challenge a friend' }));
    // Account but no friends → the section shows, locked, nudging you to add a friend.
    expect(screen.getByText('Send directly')).toBeInTheDocument();
    expect(screen.getByText('Add a friend')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bob/ })).not.toBeInTheDocument();
    expect(screen.getByText('Copy link')).toBeInTheDocument();
    unmount();

    h.friends.set([{ userId: 'fr1', displayName: 'Bob' }]);
    render(Summary);
    await fireEvent.click(screen.getByRole('button', { name: 'Challenge a friend' }));
    expect(screen.getByText('Send directly')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bob/ })).toBeInTheDocument();
  });

  it('shows a locked "create an account" teaser for an anonymous identity (link path stays)', async () => {
    lastSummary.set(summary());
    h.friends.set([{ userId: 'fr1', displayName: 'Bob' }]);
    h.identity.set({ tier: 'anonymous' });
    render(Summary);
    await fireEvent.click(screen.getByRole('button', { name: 'Challenge a friend' }));
    expect(screen.getByText('Send directly')).toBeInTheDocument();
    expect(screen.getByText('Create account')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bob/ })).not.toBeInTheDocument();
    expect(screen.getByText('Copy link')).toBeInTheDocument(); // link duel unaffected
  });

  it('picking a friend sends the challenge, confirms via toast, and blocks a duplicate send', async () => {
    lastSummary.set(summary());
    h.friends.set([{ userId: 'fr1', displayName: 'Bob' }]);
    render(Summary);

    await fireEvent.click(screen.getByRole('button', { name: 'Challenge a friend' }));
    await fireEvent.click(screen.getByRole('button', { name: /Bob/ }));

    expect(h.send).toHaveBeenCalledTimes(1);
    const [opponentId, code, score] = h.send.mock.calls[0];
    expect(opponentId).toBe('fr1');
    expect(score).toEqual({ primary: 8, tiebreak: 60000 }); // duelScore('fixed', summary)
    expect(typeof code).toBe('string');
    await waitFor(() => expect(screen.getByText('Challenge sent to Bob!')).toBeInTheDocument());

    // Bob is now marked "Sent": the row is no longer a challenge button, so it can't be re-sent.
    await waitFor(() => expect(screen.getByText('Sent')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Bob/ })).not.toBeInTheDocument();
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it('auto-submits my score to the row on finishing a received inbox duel (no return-link step)', async () => {
    // The finished run matches the staged challenge by seed, and an inbox row id is staged.
    const challenge = buildDuelPayload(summary({ correct: 5 }), 'Alice')!; // challenger scored 5
    pendingDuel.set(challenge);
    void encodeDuel(challenge);
    h.pendingInboxDuelId.set('d1');
    lastSummary.set(summary({ correct: 8 })); // I scored 8 → I win

    render(Summary);

    await waitFor(() => expect(h.submit).toHaveBeenCalledTimes(1));
    expect(h.submit.mock.calls[0][0]).toBe('d1');
    expect(h.submit.mock.calls[0][1]).toEqual({ primary: 8, tiebreak: 60000 });
    // Inbox verdict: the head-to-head shows, but there is NO "send result back" (it's auto-written).
    expect(screen.getByText('You win!')).toBeInTheDocument();
    expect(screen.queryByText('Send result back')).not.toBeInTheDocument();
    // The staged id is NOT consumed on submit — it stays set so the verdict keeps its inbox variant
    // while Summary is shown; it's cleared when the player leaves (newGame / train). A re-render can't
    // resubmit (guarded by an internal once-flag), and a re-mount would only resubmit the same score.
    expect(h.pendingInboxDuelId.get()).toBe('d1');
  });
});
