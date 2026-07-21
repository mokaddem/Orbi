import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The board store composes persistence + domain + the backend seam. We mock the seam
// (best-effort I/O) and the persistence/domain inputs so the orchestration is tested in
// isolation — no IndexedDB, no live server. The pure projection is covered in
// `backend/board.test.ts`; here we assert gating, wiring, coalescing, and never-throws.

const isBackendConfigured = vi.hoisted(() => vi.fn());
vi.mock('../../backend/client', () => ({ isBackendConfigured }));

// Keep the real `buildStatsSnapshot` (so the asserted snapshot is the true projection);
// only the write is mocked.
const upsertSnapshot = vi.hoisted(() => vi.fn());
vi.mock('../../backend/board', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../backend/board')>();
  return { ...actual, upsertSnapshot };
});

const loadSessions = vi.hoisted(() => vi.fn());
const loadRank = vi.hoisted(() => vi.fn());
const loadMastery = vi.hoisted(() => vi.fn());
const getStoredIdentity = vi.hoisted(() => vi.fn());
vi.mock('./persistence', () => ({
  loadSessions,
  loadRank,
  loadMastery,
  getStoredIdentity,
  // Minimal store so `get(prefs).playerName` works without pulling in real persistence.
  prefs: {
    subscribe: (run: (v: { playerName: string }) => void) => {
      run({ playerName: 'Ada' });
      return () => {};
    },
  },
}));

const computeStats = vi.hoisted(() => vi.fn());
const computeStreak = vi.hoisted(() => vi.fn());
vi.mock('../../domain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../domain')>();
  return { ...actual, computeStats, computeStreak };
});

import { syncBoard, __resetBoardForTests } from './board';

beforeEach(() => {
  __resetBoardForTests();
  isBackendConfigured.mockReturnValue(true);
  loadSessions.mockResolvedValue([]);
  loadRank.mockResolvedValue({
    xp: { total: 500, bySource: [] },
    progress: { rank: { index: 2, key: 'wanderer', minXp: 1000 }, next: null },
  });
  loadMastery.mockResolvedValue({ overall: { fullyMastered: 12 }, byRegion: [] });
  getStoredIdentity.mockResolvedValue({ deviceId: 'dev-1' });
  computeStats.mockReturnValue({ sessionCount: 10, totalCorrect: 80, totalQuestions: 100 });
  computeStreak.mockReturnValue({ longest: 5, current: 0, playedToday: false });
  upsertSnapshot.mockResolvedValue(true);
});

afterEach(() => vi.clearAllMocks());

describe('syncBoard', () => {
  it('projects the local headline stats and upserts them when a backend is configured', async () => {
    await syncBoard();
    expect(upsertSnapshot).toHaveBeenCalledTimes(1);
    expect(upsertSnapshot).toHaveBeenCalledWith({
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
  });

  it('is a silent no-op with no backend configured (offline-optional guard)', async () => {
    isBackendConfigured.mockReturnValue(false);
    await syncBoard();
    expect(upsertSnapshot).not.toHaveBeenCalled();
    expect(loadSessions).not.toHaveBeenCalled(); // doesn't even read local state
  });

  it('reset coherence: pushes a zeroed snapshot after a wipe', async () => {
    computeStats.mockReturnValue({ sessionCount: 0, totalCorrect: 0, totalQuestions: 0 });
    computeStreak.mockReturnValue({ longest: 0, current: 0, playedToday: false });
    loadRank.mockResolvedValue({
      xp: { total: 0, bySource: [] },
      progress: { rank: { index: 0, key: 'novice', minXp: 0 }, next: null },
    });
    loadMastery.mockResolvedValue({ overall: { fullyMastered: 0 }, byRegion: [] });
    await syncBoard();
    expect(upsertSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ xp: 0, rankIndex: 0, sessionCount: 0, fullyMastered: 0 }),
    );
  });

  it('never throws if a local load rejects (leaves the local values shown)', async () => {
    loadRank.mockRejectedValue(new Error('storage gone'));
    await expect(syncBoard()).resolves.toBeUndefined();
    expect(upsertSnapshot).not.toHaveBeenCalled();
  });

  it('coalesces a burst of triggers into one in-flight run + one follow-up', async () => {
    // Three synchronous calls: the first runs; the other two collapse into a single follow-up
    // that fires after the first settles (so it isn't awaited by the burst itself).
    await Promise.all([syncBoard(), syncBoard(), syncBoard()]);
    await vi.waitFor(() => expect(upsertSnapshot).toHaveBeenCalledTimes(2));
    // No third run is scheduled once the follow-up drains the pending flag.
    expect(upsertSnapshot).toHaveBeenCalledTimes(2);
  });
});
