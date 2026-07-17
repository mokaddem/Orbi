import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import RankPanel from './RankPanel.svelte';
import { computeXp, rankForXp, RANKS } from '../../domain';
import { setLocale } from '../../i18n';

beforeEach(() => setLocale('en'));
afterEach(() => setLocale('en'));

// 1000 + 450 + 500 + 200 + 450 = 2600 XP → Pathfinder (2200 ≤ 2600 < 4200 Navigator).
const xp = computeXp({
  stats: { totalCorrect: 100, totalQuestions: 150, sessionCount: 20 },
  streak: { longest: 10 },
  achievementsUnlocked: 3,
});

describe('RankPanel', () => {
  it('shows the current rank, its level, and a progress bar toward the next', () => {
    const progress = rankForXp(xp.total);
    render(RankPanel, { xp, progress });

    expect(screen.getByText('Pathfinder')).toBeInTheDocument();
    expect(screen.getByText(`Rank 4 of ${RANKS.length}`)).toBeInTheDocument();

    const bar = screen.getByRole('progressbar');
    // 2600 is 400 into the 2000-wide Pathfinder→Navigator band → 20%.
    expect(bar).toHaveAttribute('aria-valuenow', '20');

    // Distance to the next rank (Navigator at 4200) names it.
    expect(screen.getByText(/to Navigator/)).toBeInTheDocument();
  });

  it('breaks XP down by source, biggest first', () => {
    render(RankPanel, { xp, progress: rankForXp(xp.total) });
    expect(screen.getByText('Correct answers')).toBeInTheDocument();
    expect(screen.getByText('Questions answered')).toBeInTheDocument();
    expect(screen.getByText('Sessions played')).toBeInTheDocument();
    expect(screen.getByText('Daily streak')).toBeInTheDocument();
    expect(screen.getByText('Badges earned')).toBeInTheDocument();
  });

  it('shows a full bar and the top-rank label at the ceiling', () => {
    const top = RANKS[RANKS.length - 1];
    const maxXp = computeXp({
      stats: { totalCorrect: top.minXp, totalQuestions: 0, sessionCount: 0 },
      streak: { longest: 0 },
      achievementsUnlocked: 0,
    });
    render(RankPanel, { xp: maxXp, progress: rankForXp(maxXp.total) });

    expect(screen.getByText('Legendary Explorer')).toBeInTheDocument();
    expect(screen.getByText('Top rank reached!')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
});
