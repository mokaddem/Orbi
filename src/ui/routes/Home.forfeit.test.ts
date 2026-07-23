import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';

// Capture navigation without a mounted router.
const push = vi.fn();
vi.mock('svelte-spa-router', () => ({ push: (...args: unknown[]) => push(...args) }));

// Mock ONLY the mastery read (so a run is attemptable); the Grandmaster read + write stay REAL — this
// test is precisely about the in-memory mirror they share, so mocking them would defeat its purpose.
const loadMastery = vi.fn();
vi.mock('../stores/persistence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../stores/persistence')>();
  return { ...actual, loadMastery: (...args: unknown[]) => loadMastery(...args) };
});

import Home from './Home.svelte';
import { initPersistence, clearHistory, recordChallengeResult } from '../stores/persistence';
import { focusMastery, pendingChallenge } from '../stores/challenge';
import { FAMILIES, type FamilyMasteryResult, type MasteryFamily } from '../../domain';
import { setLocale } from '../../i18n';

beforeAll(async () => {
  await initPersistence();
});

beforeEach(async () => {
  setLocale('en');
  push.mockClear();
  focusMastery.set(false);
  pendingChallenge.set(null);
  loadMastery.mockReset();
  await clearHistory(); // reset the Grandmaster mirror + store between tests
});

afterEach(() => {
  focusMastery.set(false);
  pendingChallenge.set(null);
});

/** Only Oceania × flags fully mastered ⇒ it is the sole attemptable run. */
function soleOceaniaFlags(): FamilyMasteryResult {
  const base = { fullyMastered: 0, inProgress: 0, unseen: 0, blended: 0.5, total: 100 };
  const tally: Partial<Record<MasteryFamily, [number, number]>> = {
    map: [2, 5],
    flags: [5, 5],
    capitals: [2, 5],
  };
  const families = FAMILIES.map((f) => {
    const [mastered, total] = tally[f.key] ?? [0, 10];
    return { family: f.key, mastered, learning: total - mastered, unseen: 0, total };
  });
  return {
    overall: { families, ...base },
    byRegion: [{ region: 'Oceania', families, ...base }],
  };
}

describe('Home invite after a forfeit-on-leave (no read/write race)', () => {
  it('a just-forfeited run is gone from the invite on the very next Home mount', async () => {
    loadMastery.mockResolvedValue(soleOceaniaFlags());

    // First visit: the sole run is attemptable, so the invite is offered (it only surfaces once
    // mastery + the Grandmaster mirror have loaded).
    const first = render(Home);
    expect(await screen.findByRole('button', { name: /Enter the gauntlet/ })).toBeInTheDocument();
    first.unmount();

    // Leaving the arena mid-run records a failed attempt in the arena's teardown — and, like there,
    // we do NOT await the async IndexedDB write. The in-memory mirror updates synchronously.
    void recordChallengeResult('flags', 'Oceania', false);

    // Landing back on Home immediately: today's attempt is spent, so the invite must be gone (before
    // the fix it lingered, because Home read stale IndexedDB while the write was still in flight).
    render(Home);
    // Let Home's async reads settle (the daily card is co-loaded) before asserting the invite is gone.
    await screen.findByTestId('daily-card');
    expect(screen.queryByRole('button', { name: /Enter the gauntlet/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('grandmaster-invite')).not.toBeInTheDocument();
  });
});
