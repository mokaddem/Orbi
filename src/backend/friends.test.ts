import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Foundation client seam so friend ops run against a fake PocketBase — no network.
const pb = vi.hoisted(() => {
  const getFirstListItem = vi.fn();
  const create = vi.fn();
  const del = vi.fn();
  const getFullList = vi.fn();
  return {
    getFirstListItem,
    create,
    del,
    getFullList,
    authStore: { record: null as { id: string } | null },
    collection: () => ({ getFirstListItem, create, delete: del, getFullList }),
  };
});

const getClient = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ getClient }));

import { addFriend, removeFriend, listBoardEntries, currentUserId } from './friends';

const statsRecord = (user: string, xp: number) => ({
  user,
  displayName: `name-${user}`,
  deviceId: 'd',
  xp,
  rankIndex: 2,
  sessionCount: 5,
  totalCorrect: 10,
  totalQuestions: 20,
  longestStreak: 3,
  fullyMastered: 4,
});

beforeEach(() => {
  getClient.mockResolvedValue(pb);
  pb.getFirstListItem.mockReset();
  pb.create.mockReset();
  pb.del.mockReset();
  pb.getFullList.mockReset();
  pb.authStore.record = { id: 'me' };
});

afterEach(() => vi.clearAllMocks());

describe('currentUserId', () => {
  it('returns the signed-in id, or null', async () => {
    expect(await currentUserId()).toBe('me');
    pb.authStore.record = null;
    expect(await currentUserId()).toBeNull();
  });
});

describe('addFriend', () => {
  it('creates a canonically-ordered accepted row when none exists', async () => {
    pb.getFirstListItem.mockRejectedValue(new Error('404'));
    pb.create.mockResolvedValue({});
    // me='me', friend='aaa' → canonical (userA<userB) = aaa, me
    expect(await addFriend('aaa')).toBe(true);
    expect(pb.create).toHaveBeenCalledWith({ userA: 'aaa', userB: 'me', status: 'accepted' });
  });

  it('is idempotent — returns true without creating when the pair already exists', async () => {
    pb.getFirstListItem.mockResolvedValue({ id: 'f1' });
    expect(await addFriend('zzz')).toBe(true);
    expect(pb.create).not.toHaveBeenCalled();
  });

  it('refuses to friend yourself, with no backend, or when not signed in', async () => {
    expect(await addFriend('me')).toBe(false); // self
    pb.authStore.record = null;
    expect(await addFriend('aaa')).toBe(false); // not signed in
    getClient.mockResolvedValue(null);
    expect(await addFriend('aaa')).toBe(false); // no backend
    expect(pb.create).not.toHaveBeenCalled();
  });

  it('returns false (no throw) when the create fails', async () => {
    pb.getFirstListItem.mockRejectedValue(new Error('404'));
    pb.create.mockRejectedValue(new Error('unique index race'));
    expect(await addFriend('aaa')).toBe(false);
  });
});

describe('removeFriend', () => {
  it('deletes the pair row when found', async () => {
    pb.getFirstListItem.mockResolvedValue({ id: 'f1' });
    pb.del.mockResolvedValue(true);
    expect(await removeFriend('aaa')).toBe(true);
    expect(pb.del).toHaveBeenCalledWith('f1');
  });

  it('returns false when there is nothing to remove', async () => {
    pb.getFirstListItem.mockRejectedValue(new Error('404'));
    expect(await removeFriend('aaa')).toBe(false);
  });
});

describe('listBoardEntries', () => {
  it('maps readable stats rows and flags the self row', async () => {
    pb.getFullList.mockResolvedValue([statsRecord('me', 900), statsRecord('fr1', 500)]);
    const entries = await listBoardEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      userId: 'me',
      isSelf: true,
      xp: 900,
      displayName: 'name-me',
    });
    expect(entries[1]).toMatchObject({ userId: 'fr1', isSelf: false, xp: 500 });
  });

  it('returns [] with no backend or when not signed in', async () => {
    getClient.mockResolvedValue(null);
    expect(await listBoardEntries()).toEqual([]);
    getClient.mockResolvedValue(pb);
    pb.authStore.record = null;
    expect(await listBoardEntries()).toEqual([]);
  });

  it('returns [] (no throw) if the query fails', async () => {
    pb.getFullList.mockRejectedValue(new Error('offline'));
    expect(await listBoardEntries()).toEqual([]);
  });
});
