import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';

// Controllable duels store (inbox/history/pendingInboxDuelId + spy actions) + gate (identity/backend),
// so the route is tested in isolation. A tiny hand-rolled writable avoids importing svelte in hoisted.
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
    inbox: mk<unknown[]>([]),
    history: mk<unknown[]>([]),
    pendingInboxDuelId: mk<string | null>(null),
    refreshDuels: vi.fn(),
    dismiss: vi.fn(async () => true),
    push: vi.fn(),
    gate: { tier: 'account' as 'account' | 'anonymous', configured: true },
  };
});

vi.mock('svelte-spa-router', () => ({ push: h.push }));
vi.mock('../stores/duels', () => ({
  inbox: h.inbox,
  history: h.history,
  pendingInboxDuelId: h.pendingInboxDuelId,
  refreshDuels: h.refreshDuels,
  dismiss: h.dismiss,
}));
vi.mock('../stores/identity', () => ({
  identity: {
    subscribe(fn: (v: { tier: string }) => void) {
      fn({ tier: h.gate.tier });
      return () => {};
    },
  },
}));
vi.mock('../../backend/client', () => ({ isBackendConfigured: () => h.gate.configured }));

import Duels from './Duels.svelte';
import { pendingConfig, pendingDuel } from '../stores/game';
import { setLocale } from '../../i18n';
import type { DuelEntry } from '../stores/duels';
import type { DuelPayload } from '../../domain';

const payload = (over: Partial<DuelPayload> = {}): DuelPayload => ({
  protocolVersion: 1,
  dataVersion: 'test',
  mode: 'flag-to-country',
  type: 'fixed',
  region: 'Europe',
  length: 12,
  choices: 4,
  seed: 0x1234,
  challengerName: 'Sami',
  challengerScore: { primary: 9, tiebreak: 1000 },
  ...over,
});

const entry = (over: Partial<DuelEntry> = {}): DuelEntry => ({
  id: 'd1',
  status: 'pending',
  iAmChallenger: false,
  otherUserId: 'sami-id',
  otherName: 'Sami',
  payload: payload(),
  code: 'CODE',
  myScore: null,
  theirScore: { primary: 9, tiebreak: 1000 },
  verdict: null,
  ...over,
});

beforeEach(() => {
  setLocale('en');
  h.inbox.set([]);
  h.history.set([]);
  h.pendingInboxDuelId.set(null);
  h.gate.tier = 'account';
  h.gate.configured = true;
  h.refreshDuels.mockClear();
  h.dismiss.mockClear();
  h.push.mockClear();
  pendingConfig.set(null);
  pendingDuel.set(null);
});

afterEach(() => {
  pendingConfig.set(null);
  pendingDuel.set(null);
});

describe('Duels route (Phase 54)', () => {
  it('shows the connect-a-friend gate for an anonymous identity', () => {
    h.gate.tier = 'anonymous';
    render(Duels);
    expect(
      screen.getByText('Create an account and add a friend to duel here.'),
    ).toBeInTheDocument();
  });

  it('refreshes on mount and shows empty states when there are no duels', () => {
    render(Duels);
    expect(h.refreshDuels).toHaveBeenCalled();
    expect(
      screen.getByText('No challenges waiting. Finish a game to send one!'),
    ).toBeInTheDocument();
    expect(screen.getByText('No finished duels yet.')).toBeInTheDocument();
  });

  it('renders a pending inbox duel and launches the identical seeded run on Play', async () => {
    h.inbox.set([entry()]);
    render(Duels);
    expect(screen.getByText('Sami challenges you')).toBeInTheDocument();
    expect(screen.getByText('Beat 9')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(h.push).toHaveBeenCalledWith('/play');
    expect(get(pendingConfig)).toMatchObject({
      mode: 'flag-to-country',
      type: 'fixed',
      filter: { region: 'Europe' },
      seed: 0x1234,
    });
    expect(get(pendingDuel)?.seed).toBe(0x1234);
    // The row id is staged so the Summary writes the result straight back to it.
    expect(h.pendingInboxDuelId.get()).toBe('d1');
  });

  it('renders completed history with a verdict, per-friend W/L, and a dismiss', async () => {
    h.history.set([
      entry({
        id: 'h1',
        status: 'complete',
        iAmChallenger: true,
        otherUserId: 'bob',
        otherName: 'Bob',
        myScore: { primary: 9, tiebreak: 1000 },
        theirScore: { primary: 8, tiebreak: 900 },
        verdict: 'win',
      }),
    ]);
    render(Duels);
    expect(screen.getByText('vs Bob')).toBeInTheDocument();
    expect(screen.getByText('Won')).toBeInTheDocument();
    expect(screen.getByText('Bob · 1W · 0L')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Remove from history' }));
    expect(h.dismiss).toHaveBeenCalledWith('h1');
  });
});
