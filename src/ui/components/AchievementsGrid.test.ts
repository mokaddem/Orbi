import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
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
  it('counts earned badges and flags them', () => {
    const { container } = render(AchievementsGrid, { achievements });
    expect(screen.getByText('1 of 3 earned')).toBeInTheDocument();
    expect(container.querySelector('[data-id="first-round"]')).toHaveClass('earned');
    expect(container.querySelector('[data-id="speedy"]')).not.toHaveClass('earned');
  });

  it('shows every badge title and its how-to-earn description', () => {
    render(AchievementsGrid, { achievements });
    expect(screen.getByText('First round')).toBeInTheDocument();
    expect(screen.getByText('Finish your first session.')).toBeInTheDocument();
    expect(screen.getByText('Speed demon')).toBeInTheDocument();
    expect(screen.getByText('Europe mastered')).toBeInTheDocument();
  });
});
