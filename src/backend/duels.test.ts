import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Foundation client seam so duel ops run against a fake PocketBase — no network.
const pb = vi.hoisted(() => {
  const create = vi.fn();
  const update = vi.fn();
  const getOne = vi.fn();
  const getFullList = vi.fn();
  return {
    create,
    update,
    getOne,
    getFullList,
    authStore: { record: null as { id: string } | null },
    collection: () => ({ create, update, getOne, getFullList }),
  };
});

const getClient = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ getClient }));

import {
  sendDuel,
  listInbox,
  listOutbox,
  submitResult,
  listHistory,
  dismissDuel,
  duelViewFromRecord,
} from './duels';

/** A raw `duels` record as PocketBase would return it. */
const rawDuel = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  challenger: 'me',
  opponent: 'fr1',
  challenge: 'ENCODED',
  challengerPrimary: 9,
  challengerTiebreak: 12345,
  opponentPrimary: 0,
  opponentTiebreak: 0,
  status: 'pending',
  opponentName: 'Bob',
  challengerDismissed: false,
  opponentDismissed: false,
  ...over,
});

beforeEach(() => {
  getClient.mockResolvedValue(pb);
  pb.create.mockReset();
  pb.update.mockReset();
  pb.getOne.mockReset();
  pb.getFullList.mockReset();
  pb.authStore.record = { id: 'me' };
});

afterEach(() => vi.clearAllMocks());

describe('duelViewFromRecord', () => {
  it('projects a pending row with a null opponent score', () => {
    const v = duelViewFromRecord(rawDuel() as never);
    expect(v).toMatchObject({
      id: 'd1',
      challengerId: 'me',
      opponentId: 'fr1',
      challenge: 'ENCODED',
      challengerScore: { primary: 9, tiebreak: 12345 },
      opponentScore: null,
      status: 'pending',
      opponentName: 'Bob',
    });
  });

  it('surfaces the opponent score once complete', () => {
    const v = duelViewFromRecord(
      rawDuel({ status: 'complete', opponentPrimary: 10, opponentTiebreak: 9999 }) as never,
    );
    expect(v.status).toBe('complete');
    expect(v.opponentScore).toEqual({ primary: 10, tiebreak: 9999 });
  });

  it('reads the per-side dismiss flags defensively', () => {
    const v = duelViewFromRecord(rawDuel({ challengerDismissed: true }) as never);
    expect(v.challengerDismissed).toBe(true);
    expect(v.opponentDismissed).toBe(false);
  });
});

describe('sendDuel', () => {
  it('creates a pending row with the caller as challenger and clamped scores', async () => {
    pb.create.mockResolvedValue({ id: 'newid' });
    const id = await sendDuel('fr1', 'ENCODED', { primary: 9.7, tiebreak: -3 }, 'Bob');
    expect(id).toBe('newid');
    expect(pb.create).toHaveBeenCalledWith({
      challenger: 'me',
      opponent: 'fr1',
      challenge: 'ENCODED',
      challengerPrimary: 9, // floored
      challengerTiebreak: 0, // clamped to >= 0
      status: 'pending',
      opponentName: 'Bob',
    });
  });

  it('returns null with no backend, not signed in, or a self-target', async () => {
    getClient.mockResolvedValue(null);
    expect(await sendDuel('fr1', 'E', { primary: 1, tiebreak: 0 }, 'B')).toBeNull();
    getClient.mockResolvedValue(pb);
    pb.authStore.record = null;
    expect(await sendDuel('fr1', 'E', { primary: 1, tiebreak: 0 }, 'B')).toBeNull();
    pb.authStore.record = { id: 'me' };
    expect(await sendDuel('me', 'E', { primary: 1, tiebreak: 0 }, 'B')).toBeNull(); // self
    expect(pb.create).not.toHaveBeenCalled();
  });

  it('returns null (no throw) when the create is rejected (e.g. not a friend)', async () => {
    pb.create.mockRejectedValue(new Error('403'));
    expect(await sendDuel('fr1', 'E', { primary: 1, tiebreak: 0 }, 'B')).toBeNull();
  });
});

describe('listInbox', () => {
  it('filters to pending duels where I am the opponent, newest first', async () => {
    pb.getFullList.mockResolvedValue([rawDuel({ opponent: 'me', challenger: 'fr1' })]);
    const inbox = await listInbox();
    expect(inbox).toHaveLength(1);
    expect(pb.getFullList).toHaveBeenCalledWith({
      filter:
        'opponent = "me" && status = "pending" && opponentDismissed != true && (expiresAt = "" || expiresAt > @now)',
      sort: '-created',
      requestKey: 'duels-inbox',
    });
  });

  it('returns [] with no backend / not signed in / on failure', async () => {
    getClient.mockResolvedValue(null);
    expect(await listInbox()).toEqual([]);
    getClient.mockResolvedValue(pb);
    pb.authStore.record = null;
    expect(await listInbox()).toEqual([]);
    pb.authStore.record = { id: 'me' };
    pb.getFullList.mockRejectedValue(new Error('offline'));
    expect(await listInbox()).toEqual([]);
  });
});

describe('listOutbox', () => {
  it('filters to pending duels where I am the challenger', async () => {
    pb.getFullList.mockResolvedValue([]);
    await listOutbox();
    expect(pb.getFullList).toHaveBeenCalledWith({
      filter: 'challenger = "me" && status = "pending" && challengerDismissed != true',
      sort: '-created',
      requestKey: 'duels-outbox',
    });
  });
});

describe('submitResult', () => {
  it('writes the opponent score and flips status to complete', async () => {
    pb.update.mockResolvedValue({});
    expect(await submitResult('d1', { primary: 10.4, tiebreak: 9999 })).toBe(true);
    expect(pb.update).toHaveBeenCalledWith('d1', {
      opponentPrimary: 10,
      opponentTiebreak: 9999,
      status: 'complete',
    });
  });

  it('returns false with no backend / not signed in / on failure', async () => {
    getClient.mockResolvedValue(null);
    expect(await submitResult('d1', { primary: 1, tiebreak: 0 })).toBe(false);
    getClient.mockResolvedValue(pb);
    pb.authStore.record = null;
    expect(await submitResult('d1', { primary: 1, tiebreak: 0 })).toBe(false);
    pb.authStore.record = { id: 'me' };
    pb.update.mockRejectedValue(new Error('offline'));
    expect(await submitResult('d1', { primary: 1, tiebreak: 0 })).toBe(false);
  });
});

describe('listHistory', () => {
  it('filters to completed duels I own that I have not dismissed', async () => {
    pb.getFullList.mockResolvedValue([rawDuel({ status: 'complete' })]);
    const hist = await listHistory();
    expect(hist).toHaveLength(1);
    expect(pb.getFullList).toHaveBeenCalledWith({
      filter:
        'status = "complete" && ((challenger = "me" && challengerDismissed != true) || (opponent = "me" && opponentDismissed != true))',
      sort: '-created',
      requestKey: 'duels-history',
    });
  });

  it('returns [] (no throw) on failure', async () => {
    pb.getFullList.mockRejectedValue(new Error('offline'));
    expect(await listHistory()).toEqual([]);
  });
});

describe('dismissDuel', () => {
  it("sets challengerDismissed when I'm the challenger", async () => {
    pb.getOne.mockResolvedValue(rawDuel({ challenger: 'me', opponent: 'fr1' }));
    pb.update.mockResolvedValue({});
    expect(await dismissDuel('d1')).toBe(true);
    expect(pb.update).toHaveBeenCalledWith('d1', { challengerDismissed: true });
  });

  it("sets opponentDismissed when I'm the opponent", async () => {
    pb.getOne.mockResolvedValue(rawDuel({ challenger: 'fr1', opponent: 'me' }));
    pb.update.mockResolvedValue({});
    expect(await dismissDuel('d1')).toBe(true);
    expect(pb.update).toHaveBeenCalledWith('d1', { opponentDismissed: true });
  });

  it('returns false when I am not an endpoint of the duel', async () => {
    pb.getOne.mockResolvedValue(rawDuel({ challenger: 'x', opponent: 'y' }));
    expect(await dismissDuel('d1')).toBe(false);
    expect(pb.update).not.toHaveBeenCalled();
  });

  it('returns false (no throw) when the read fails', async () => {
    pb.getOne.mockRejectedValue(new Error('404'));
    expect(await dismissDuel('d1')).toBe(false);
  });
});
