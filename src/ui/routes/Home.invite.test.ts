import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';

// Capture navigation without a mounted router.
const push = vi.fn();
vi.mock('svelte-spa-router', () => ({ push: (...args: unknown[]) => push(...args) }));

// Control only the two reads the invitation card depends on; everything else in the persistence
// controller (initPersistence, the other Home loaders) stays real, so the store still initializes.
const loadMastery = vi.fn();
const loadGrandmaster = vi.fn();
vi.mock('../stores/persistence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../stores/persistence')>();
  return {
    ...actual,
    loadMastery: (...args: unknown[]) => loadMastery(...args),
    loadGrandmaster: (...args: unknown[]) => loadGrandmaster(...args),
  };
});

import Home from './Home.svelte';
import { initPersistence } from '../stores/persistence';
import { focusMastery, pendingChallenge } from '../stores/challenge';
import { FAMILIES, type FamilyMasteryResult, type MasteryFamily } from '../../domain';
import { setLocale } from '../../i18n';

beforeAll(async () => {
  await initPersistence();
});

beforeEach(() => {
  setLocale('en');
  push.mockClear();
  focusMastery.set(false);
  pendingChallenge.set(null);
  loadMastery.mockReset();
  loadGrandmaster.mockReset();
});

afterEach(() => {
  focusMastery.set(false);
  pendingChallenge.set(null);
});

const EMPTY = { certified: new Set<string>(), spentToday: new Set<string>() };

/** Build a mastery result from per-region per-family [mastered, total] tallies (FAMILIES order). */
function mastery(
  regions: Record<string, Partial<Record<MasteryFamily, [number, number]>>>,
): FamilyMasteryResult {
  const base = { fullyMastered: 0, inProgress: 0, unseen: 0, blended: 0.5, total: 100 };
  const familiesFor = (t: Partial<Record<MasteryFamily, [number, number]>>) =>
    FAMILIES.map((f) => {
      const [mastered, total] = t[f.key] ?? [0, 10];
      return { family: f.key, mastered, learning: total - mastered, unseen: 0, total };
    });
  return {
    overall: { families: familiesFor({}), ...base },
    byRegion: Object.entries(regions).map(([region, t]) => ({
      region,
      families: familiesFor(t),
      ...base,
    })),
  };
}

describe('Home — Grandmaster invitation card (Phase 45 ⑥)', () => {
  it('hides the card when no challenge is attemptable today', async () => {
    loadMastery.mockResolvedValue(mastery({ Oceania: { flags: [3, 5] } })); // nothing fully mastered
    loadGrandmaster.mockResolvedValue(EMPTY);

    render(Home);

    // Let Home's async reads settle (the daily card is co-loaded), then confirm the invite never
    // surfaces — nothing is fully mastered, so no run is attemptable.
    await screen.findByTestId('daily-card');
    expect(screen.queryByTestId('grandmaster-invite')).not.toBeInTheDocument();
  });

  it('shows the card and, with more than one run available, routes to Progress with the focus flag', async () => {
    loadMastery.mockResolvedValue(
      mastery({
        Oceania: { map: [5, 5], flags: [5, 5], capitals: [2, 5] },
        Africa: { flags: [10, 10] },
      }),
    );
    loadGrandmaster.mockResolvedValue(EMPTY);

    render(Home);

    const cta = await screen.findByRole('button', { name: /Enter the gauntlet/ });
    await fireEvent.click(cta);

    // No single run to pick → hand off to Progress, which will spotlight its World Mastery panel.
    expect(get(focusMastery)).toBe(true);
    expect(push).toHaveBeenCalledWith('/progress');
    // It did not open an offer modal or stage a run.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(get(pendingChallenge)).toBeNull();
  });

  it('opens the offer modal for the sole available run, and Accept stages it into the arena', async () => {
    // Only Oceania × flags is fully mastered → exactly one attemptable run.
    loadMastery.mockResolvedValue(
      mastery({
        Oceania: { map: [2, 5], flags: [5, 5], capitals: [2, 5] },
        Africa: { flags: [8, 10] },
      }),
    );
    loadGrandmaster.mockResolvedValue(EMPTY);

    render(Home);

    const cta = await screen.findByRole('button', { name: /Enter the gauntlet/ });
    await fireEvent.click(cta);

    // Exactly one → the offer modal opens here on Home, naming that specific run.
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('The Grandmaster Challenge');
    expect(dialog).toHaveTextContent(/Flags/);
    expect(dialog).toHaveTextContent(/Oceania/);
    expect(get(focusMastery)).toBe(false); // the single case does not hand off to Progress

    await fireEvent.click(screen.getByRole('button', { name: 'Accept the challenge' }));
    expect(get(pendingChallenge)).toMatchObject({ family: 'flags', region: 'Oceania' });
    expect(push).toHaveBeenCalledWith('/challenge');
  });
});
