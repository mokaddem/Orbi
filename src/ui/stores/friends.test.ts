import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock the backend seam + config + identity store so the friends orchestration is tested in isolation.
const listBoardEntries = vi.hoisted(() => vi.fn());
const backendAddFriend = vi.hoisted(() => vi.fn());
const backendRemoveFriend = vi.hoisted(() => vi.fn());
const currentUserId = vi.hoisted(() => vi.fn());
vi.mock('../../backend/friends', () => ({
  listBoardEntries,
  addFriend: backendAddFriend,
  removeFriend: backendRemoveFriend,
  currentUserId,
}));

const isBackendConfigured = vi.hoisted(() => vi.fn());
vi.mock('../../backend/client', () => ({ isBackendConfigured }));

// Minimal identity store whose tier we can flip per test.
const identityState = vi.hoisted(() => ({ tier: 'account' as 'account' | 'anonymous' }));
vi.mock('./identity', () => ({
  identity: {
    subscribe: (run: (v: { tier: string }) => void) => {
      run({ tier: identityState.tier });
      return () => {};
    },
  },
}));

import {
  friends,
  refreshFriends,
  addFriendFromInvite,
  unfriend,
  __resetFriendsForTests,
} from './friends';

const entry = (userId: string, xp: number, isSelf = false) => ({
  userId,
  displayName: `n-${userId}`,
  xp,
  rankIndex: 1,
  fullyMastered: 2,
  sessionCount: 3,
  isSelf,
});

beforeEach(() => {
  __resetFriendsForTests();
  identityState.tier = 'account';
  isBackendConfigured.mockReturnValue(true);
  listBoardEntries.mockResolvedValue([]);
  backendAddFriend.mockResolvedValue(true);
  backendRemoveFriend.mockResolvedValue(true);
  currentUserId.mockResolvedValue('me');
});

afterEach(() => vi.clearAllMocks());

describe('refreshFriends', () => {
  it('lists friends (self excluded), sorted by XP desc', async () => {
    listBoardEntries.mockResolvedValue([
      entry('me', 999, true),
      entry('fr-low', 100),
      entry('fr-high', 800),
    ]);
    await refreshFriends();
    expect(get(friends).map((f) => f.userId)).toEqual(['fr-high', 'fr-low']);
  });

  it('is a no-op (clears the list) with no backend', async () => {
    isBackendConfigured.mockReturnValue(false);
    await refreshFriends();
    expect(get(friends)).toEqual([]);
    expect(listBoardEntries).not.toHaveBeenCalled();
  });
});

describe('addFriendFromInvite', () => {
  it('adds and refreshes when configured + account + not self', async () => {
    listBoardEntries.mockResolvedValue([entry('me', 999, true), entry('fr1', 500)]);
    expect(await addFriendFromInvite('fr1')).toBe('ok');
    expect(backendAddFriend).toHaveBeenCalledWith('fr1');
    expect(get(friends).map((f) => f.userId)).toEqual(['fr1']);
  });

  it('gates on a real account (anonymous → no-account)', async () => {
    identityState.tier = 'anonymous';
    expect(await addFriendFromInvite('fr1')).toBe('no-account');
    expect(backendAddFriend).not.toHaveBeenCalled();
  });

  it('no-ops with no backend', async () => {
    isBackendConfigured.mockReturnValue(false);
    expect(await addFriendFromInvite('fr1')).toBe('no-backend');
  });

  it('refuses your own invite', async () => {
    currentUserId.mockResolvedValue('me');
    expect(await addFriendFromInvite('me')).toBe('self');
    expect(backendAddFriend).not.toHaveBeenCalled();
  });

  it('reports failure when the backend add fails', async () => {
    backendAddFriend.mockResolvedValue(false);
    expect(await addFriendFromInvite('fr1')).toBe('failed');
  });
});

describe('unfriend', () => {
  it('removes then refreshes on success', async () => {
    expect(await unfriend('fr1')).toBe(true);
    expect(backendRemoveFriend).toHaveBeenCalledWith('fr1');
    expect(listBoardEntries).toHaveBeenCalled(); // refresh ran
  });

  it('returns false without refreshing on failure', async () => {
    backendRemoveFriend.mockResolvedValue(false);
    expect(await unfriend('fr1')).toBe(false);
    expect(listBoardEntries).not.toHaveBeenCalled();
  });
});
