import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import RankChip from './RankChip.svelte';
import { computeXp, rankForXp } from '../../domain';
import { setLocale } from '../../i18n';

beforeEach(() => setLocale('en'));
afterEach(() => setLocale('en'));

describe('RankChip', () => {
  it('shows the rank name and progress toward the next rank', () => {
    // 500 XP correct → Scout (400 ≤ 500 < 1000 Wanderer).
    const xp = computeXp({
      stats: { totalCorrect: 50, totalQuestions: 0, sessionCount: 0 },
      streak: { longest: 0 },
      achievementsUnlocked: 0,
    });
    render(RankChip, { xp, progress: rankForXp(xp.total) });

    expect(screen.getByText('Scout')).toBeInTheDocument();
    expect(screen.getByText(/to Wanderer/)).toBeInTheDocument();
    // 500 is 100 into the 600-wide Scout→Wanderer band → 17% (rounded).
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '17');
  });

  it('renders in French with the localized rank name', () => {
    setLocale('fr');
    const xp = computeXp({
      stats: { totalCorrect: 50, totalQuestions: 0, sessionCount: 0 },
      streak: { longest: 0 },
      achievementsUnlocked: 0,
    });
    render(RankChip, { xp, progress: rankForXp(xp.total) });
    expect(screen.getByText('Éclaireur')).toBeInTheDocument();
  });
});
