import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Foundation client seam so board ops run against a fake PocketBase — no network,
// no live server. `getClient` returns our stub (or null to simulate no backend).
const pb = vi.hoisted(() => {
  const getFirstListItem = vi.fn();
  const update = vi.fn();
  const create = vi.fn();
  return {
    getFirstListItem,
    update,
    create,
    authStore: { record: null as { id: string } | null },
    collection: () => ({ getFirstListItem, update, create }),
  };
});

const getClient = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ getClient }));

import { buildStatsSnapshot, upsertSnapshot, readOwnSnapshot, type StatsSnapshot } from './board';

const snap = (over: Partial<StatsSnapshot> = {}): StatsSnapshot => ({
  displayName: 'Ada',
  deviceId: 'dev-1',
  xp: 500,
  rankIndex: 2,
  sessionCount: 10,
  totalCorrect: 80,
  totalQuestions: 100,
  longestStreak: 5,
  fullyMastered: 12,
  ...over,
});

beforeEach(() => {
  getClient.mockResolvedValue(pb);
  pb.getFirstListItem.mockReset();
  pb.update.mockReset();
  pb.create.mockReset();
  pb.authStore.record = { id: 'u1' }; // signed in by default
});

afterEach(() => vi.clearAllMocks());

describe('buildStatsSnapshot (pure projection)', () => {
  it('projects the local numbers verbatim', () => {
    expect(
      buildStatsSnapshot({
        displayName: 'Ada',
        deviceId: 'dev-1',
        sessionCount: 10,
        totalCorrect: 80,
        totalQuestions: 100,
        xp: 500,
        rankIndex: 2,
        longestStreak: 5,
        fullyMastered: 12,
      }),
    ).toEqual(snap());
  });

  it('clamps every count to a non-negative integer', () => {
    const out = buildStatsSnapshot({
      displayName: 'X',
      deviceId: 'd',
      sessionCount: 3.9,
      totalCorrect: -2,
      totalQuestions: Number.NaN,
      xp: 12.6,
      rankIndex: -1,
      longestStreak: Number.POSITIVE_INFINITY,
      fullyMastered: 4.2,
    });
    expect(out).toMatchObject({
      sessionCount: 3,
      totalCorrect: 0,
      totalQuestions: 0,
      xp: 12,
      rankIndex: 0,
      longestStreak: 0,
      fullyMastered: 4,
    });
  });
});

describe('upsertSnapshot', () => {
  it('updates the existing row when one is found, binding user from the auth record', async () => {
    pb.getFirstListItem.mockResolvedValue({ id: 'row1' });
    pb.update.mockResolvedValue({});
    expect(await upsertSnapshot(snap())).toBe(true);
    expect(pb.update).toHaveBeenCalledWith(
      'row1',
      expect.objectContaining({ user: 'u1', xp: 500 }),
    );
    expect(pb.create).not.toHaveBeenCalled();
  });

  it('creates the row when none exists yet (lookup rejects)', async () => {
    pb.getFirstListItem.mockRejectedValue(new Error('404'));
    pb.create.mockResolvedValue({});
    expect(await upsertSnapshot(snap())).toBe(true);
    expect(pb.create).toHaveBeenCalledWith(
      expect.objectContaining({ user: 'u1', displayName: 'Ada' }),
    );
  });

  it('returns false (no throw) when create also fails', async () => {
    pb.getFirstListItem.mockRejectedValue(new Error('404'));
    pb.create.mockRejectedValue(new Error('offline'));
    expect(await upsertSnapshot(snap())).toBe(false);
  });

  it('no-ops when not signed in (no auth record)', async () => {
    pb.authStore.record = null;
    expect(await upsertSnapshot(snap())).toBe(false);
    expect(pb.getFirstListItem).not.toHaveBeenCalled();
    expect(pb.update).not.toHaveBeenCalled();
    expect(pb.create).not.toHaveBeenCalled();
  });

  it('no-ops with no backend (getClient null)', async () => {
    getClient.mockResolvedValue(null);
    expect(await upsertSnapshot(snap())).toBe(false);
  });
});

describe('readOwnSnapshot', () => {
  it('maps the owner’s row (defensive on field types)', async () => {
    pb.getFirstListItem.mockResolvedValue({
      displayName: 'Ada',
      deviceId: 'dev-1',
      xp: 500,
      rankIndex: 2,
      sessionCount: 10,
      totalCorrect: 80,
      totalQuestions: 100,
      longestStreak: 5,
      fullyMastered: 12,
    });
    expect(await readOwnSnapshot()).toEqual(snap());
  });

  it('returns null on any failure and with no backend', async () => {
    pb.getFirstListItem.mockRejectedValue(new Error('nope'));
    expect(await readOwnSnapshot()).toBeNull();
    getClient.mockResolvedValue(null);
    expect(await readOwnSnapshot()).toBeNull();
  });
});
