import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import AchievementsGrid from './AchievementsGrid.svelte';
import { setLocale } from '../../i18n';
import type { AchievementView } from '../stores/persistence';

beforeEach(() => setLocale('en'));
afterEach(() => setLocale('en'));

const achievements: AchievementView[] = [
  { id: 'first-round', unlocked: true, unlockedAt: 1000, justUnlocked: false },
  { id: 'speedy', unlocked: false, justUnlocked: false },
  { id: 'mastered-europe', unlocked: false, justUnlocked: false, region: 'Europe' },
];

describe('AchievementsGrid', () => {
  it('counts earned badges and flags the earned tiles', () => {
    const { container } = render(AchievementsGrid, { achievements });
    expect(screen.getByText('1 of 3 earned')).toBeInTheDocument();
    expect(container.querySelector('[data-id="first-round"]')).toHaveClass('earned');
    expect(container.querySelector('[data-id="speedy"]')).not.toHaveClass('earned');
  });

  it('renders one punchcard segment per badge, filled for the earned ones', () => {
    const { container } = render(AchievementsGrid, { achievements });
    const segs = container.querySelectorAll('.seg');
    expect(segs).toHaveLength(3);
    expect(container.querySelectorAll('.seg.on')).toHaveLength(1);
  });

  it('shows every badge title on its tile', () => {
    render(AchievementsGrid, { achievements });
    // Locked, non-selected badges show their title exactly once (on the tile).
    expect(screen.getByText('Speed demon')).toBeInTheDocument();
    expect(screen.getByText('Europe mastered')).toBeInTheDocument();
  });

  it('reveals a how-to-earn only after the player taps a badge (no auto-selection)', async () => {
    const { container } = render(AchievementsGrid, { achievements });
    // Nothing is selected by default — the sheet shows the hint, no description.
    expect(screen.getByText('Tap a badge to see how to earn it.')).toBeInTheDocument();
    expect(screen.queryByText('Finish your first session.')).not.toBeInTheDocument();

    await fireEvent.click(container.querySelector('[data-id="first-round"]')!);
    expect(screen.getByText('Finish your first session.')).toBeInTheDocument();

    // Tapping another badge switches the sheet to it.
    const speedyDesc = 'Average under 3 seconds per answer over a round of 5 or more.';
    await fireEvent.click(container.querySelector('[data-id="speedy"]')!);
    expect(screen.getByText(speedyDesc)).toBeInTheDocument();
    expect(screen.queryByText('Finish your first session.')).not.toBeInTheDocument();
  });

  it('groups extra-topic badges under localized section headers', () => {
    const extras: AchievementView[] = [
      { id: 'capitals-collector', unlocked: true, justUnlocked: false, topic: 'capitals' },
      { id: 'languages-collector', unlocked: false, justUnlocked: false, topic: 'languages' },
    ];
    render(AchievementsGrid, { achievements: extras, groupByTopic: true });
    expect(screen.getByRole('heading', { name: 'Capitals' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Languages' })).toBeInTheDocument();
  });
});
