import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { encodeDuel, DUEL_PROTOCOL_VERSION, type DuelPayload } from '../../domain';
import type { DuelRecordView } from '../../backend/duels';

// Mock the backend seam + config + friend id resolver so the orchestration is tested in isolation.
const sendDuel = vi.hoisted(() => vi.fn());
const submitResult = vi.hoisted(() => vi.fn());
const listInbox = vi.hoisted(() => vi.fn());
const listHistory = vi.hoisted(() => vi.fn());
const dismissDuel = vi.hoisted(() => vi.fn());
vi.mock('../../backend/duels', () => ({
  sendDuel,
  submitResult,
  listInbox,
  listHistory,
  dismissDuel,
}));

const currentUserId = vi.hoisted(() => vi.fn());
vi.mock('../../backend/friends', () => ({ currentUserId }));

const isBackendConfigured = vi.hoisted(() => vi.fn());
vi.mock('../../backend/client', () => ({ isBackendConfigured }));

const identityState = vi.hoisted(() => ({ tier: 'account' as 'account' | 'anonymous' }));
vi.mock('./identity', () => ({
  identity: {
    subscribe: (run: (v: { tier: string }) => void) => {
      run({ tier: identityState.tier });
      return () => {};
    },
  },
}));

// A controllable friend list for the send-time pre-check.
const friendsState = vi.hoisted(() => ({ list: [] as { userId: string }[] }));
vi.mock('./friends', () => ({
  friends: {
    subscribe: (run: (v: { userId: string }[]) => void) => {
      run(friendsState.list);
      return () => {};
    },
  },
}));

import {
  inbox,
  history,
  pendingCount,
  refreshDuels,
  send,
  submit,
  dismiss,
  __resetDuelsForTests,
} from './duels';

const challenge = (over: Partial<DuelPayload> = {}): string =>
  encodeDuel({
    protocolVersion: DUEL_PROTOCOL_VERSION,
    dataVersion: 'test',
    mode: 'flag-to-country',
    type: 'fixed',
    length: 10,
    choices: 4,
    seed: 12345,
    challengerName: 'Alice',
    challengerScore: { primary: 9, tiebreak: 1000 },
    ...over,
  });

const view = (over: Partial<DuelRecordView> = {}): DuelRecordView => ({
  id: 'd1',
  challengerId: 'alice',
  opponentId: 'me',
  challenge: challenge(),
  challengerScore: { primary: 9, tiebreak: 1000 },
  opponentScore: null,
  status: 'pending',
  opponentName: 'MyName',
  challengerDismissed: false,
  opponentDismissed: false,
  ...over,
});

beforeEach(() => {
  __resetDuelsForTests();
  identityState.tier = 'account';
  friendsState.list = [];
  isBackendConfigured.mockReturnValue(true);
  currentUserId.mockResolvedValue('me');
  sendDuel.mockResolvedValue('newid');
  submitResult.mockResolvedValue(true);
  dismissDuel.mockResolvedValue(true);
  listInbox.mockResolvedValue([]);
  listHistory.mockResolvedValue([]);
});

afterEach(() => vi.clearAllMocks());

describe('refreshDuels', () => {
  it('decodes a received pending duel into an inbox entry (challenger name + their score)', async () => {
    listInbox.mockResolvedValue([view()]);
    await refreshDuels();
    const entries = get(inbox);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'd1',
      status: 'pending',
      iAmChallenger: false,
      otherUserId: 'alice',
      otherName: 'Alice', // from the decoded payload
      myScore: null,
      theirScore: { primary: 9, tiebreak: 1000 },
      verdict: null,
    });
    expect(get(pendingCount)).toBe(1);
  });

  it('computes my verdict for a completed duel I won (challenger side)', async () => {
    listHistory.mockResolvedValue([
      view({
        challengerId: 'me',
        opponentId: 'bob',
        status: 'complete',
        opponentScore: { primary: 8, tiebreak: 900 },
        opponentName: 'Bob',
      }),
    ]);
    await refreshDuels();
    const h = get(history);
    expect(h[0]).toMatchObject({
      iAmChallenger: true,
      otherUserId: 'bob',
      otherName: 'Bob', // denormalized column for the challenger side
      myScore: { primary: 9, tiebreak: 1000 },
      theirScore: { primary: 8, tiebreak: 900 },
      verdict: 'win',
    });
  });

  it('computes my verdict for a completed duel I received (opponent side)', async () => {
    listHistory.mockResolvedValue([
      view({ status: 'complete', opponentScore: { primary: 10, tiebreak: 800 } }),
    ]);
    await refreshDuels();
    expect(get(history)[0]).toMatchObject({
      iAmChallenger: false,
      otherName: 'Alice',
      myScore: { primary: 10, tiebreak: 800 },
      theirScore: { primary: 9, tiebreak: 1000 },
      verdict: 'win', // 10 > 9
    });
  });

  it('skips an entry whose challenge will not decode', async () => {
    listInbox.mockResolvedValue([view({ challenge: 'not-a-valid-code' })]);
    await refreshDuels();
    expect(get(inbox)).toEqual([]);
  });

  it('no-ops (clears both lists) with no backend', async () => {
    isBackendConfigured.mockReturnValue(false);
    await refreshDuels();
    expect(get(inbox)).toEqual([]);
    expect(get(history)).toEqual([]);
    expect(listInbox).not.toHaveBeenCalled();
  });

  it('no-ops for an anonymous identity (account-gated)', async () => {
    identityState.tier = 'anonymous';
    await refreshDuels();
    expect(listInbox).not.toHaveBeenCalled();
  });

  it('clears when the signed-in id cannot be resolved', async () => {
    currentUserId.mockResolvedValue(null);
    listInbox.mockResolvedValue([view()]);
    await refreshDuels();
    expect(get(inbox)).toEqual([]);
  });
});

describe('send', () => {
  it('sends to an accepted friend and refreshes', async () => {
    friendsState.list = [{ userId: 'fr1' }];
    expect(await send('fr1', 'CODE', { primary: 9, tiebreak: 1000 }, 'Bob')).toBe('ok');
    expect(sendDuel).toHaveBeenCalledWith('fr1', 'CODE', { primary: 9, tiebreak: 1000 }, 'Bob');
    expect(listInbox).toHaveBeenCalled(); // refresh ran
  });

  it('reports not-friends when the target is not in the friend graph', async () => {
    friendsState.list = [{ userId: 'someone-else' }];
    expect(await send('fr1', 'CODE', { primary: 1, tiebreak: 0 }, 'B')).toBe('not-friends');
    expect(sendDuel).not.toHaveBeenCalled();
  });

  it('gates on backend + real account', async () => {
    isBackendConfigured.mockReturnValue(false);
    expect(await send('fr1', 'C', { primary: 1, tiebreak: 0 }, 'B')).toBe('no-backend');
    isBackendConfigured.mockReturnValue(true);
    identityState.tier = 'anonymous';
    expect(await send('fr1', 'C', { primary: 1, tiebreak: 0 }, 'B')).toBe('no-account');
    expect(sendDuel).not.toHaveBeenCalled();
  });

  it('reports failure when the server rejects the send', async () => {
    friendsState.list = [{ userId: 'fr1' }];
    sendDuel.mockResolvedValue(null);
    expect(await send('fr1', 'C', { primary: 1, tiebreak: 0 }, 'B')).toBe('failed');
  });
});

describe('submit', () => {
  it('writes the result and refreshes', async () => {
    expect(await submit('d1', { primary: 7, tiebreak: 500 })).toBe('ok');
    expect(submitResult).toHaveBeenCalledWith('d1', { primary: 7, tiebreak: 500 });
    expect(listInbox).toHaveBeenCalled();
  });

  it('gates on backend + account and reports failure', async () => {
    isBackendConfigured.mockReturnValue(false);
    expect(await submit('d1', { primary: 1, tiebreak: 0 })).toBe('no-backend');
    isBackendConfigured.mockReturnValue(true);
    identityState.tier = 'anonymous';
    expect(await submit('d1', { primary: 1, tiebreak: 0 })).toBe('no-account');
    identityState.tier = 'account';
    submitResult.mockResolvedValue(false);
    expect(await submit('d1', { primary: 1, tiebreak: 0 })).toBe('failed');
  });
});

describe('dismiss', () => {
  it('dismisses then refreshes on success', async () => {
    expect(await dismiss('d1')).toBe(true);
    expect(dismissDuel).toHaveBeenCalledWith('d1');
    expect(listHistory).toHaveBeenCalled();
  });

  it('returns false without refreshing on failure', async () => {
    dismissDuel.mockResolvedValue(false);
    expect(await dismiss('d1')).toBe(false);
    expect(listHistory).not.toHaveBeenCalled();
  });
});
