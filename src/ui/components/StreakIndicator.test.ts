import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import StreakIndicator from './StreakIndicator.svelte';
import type { StreakInfo } from '../../domain';
import { setLocale } from '../../i18n';

beforeEach(() => setLocale('en'));
afterEach(() => setLocale('en'));

const emberCount = (current: number): number => {
  const streak: StreakInfo = { current, longest: current, playedToday: true };
  const { container } = render(StreakIndicator, { streak });
  return container.querySelectorAll('.ember').length;
};

describe('StreakIndicator', () => {
  it('nudges the player to start when there is no streak', () => {
    render(StreakIndicator, { streak: { current: 0, longest: 0, playedToday: false } });
    const el = screen.getByTestId('streak-indicator');
    expect(el).not.toHaveClass('active');
    expect(screen.getByText('Start a streak today')).toBeInTheDocument();
  });

  it('shows the count and confirms play when today is done', () => {
    render(StreakIndicator, { streak: { current: 5, longest: 9, playedToday: true } });
    expect(screen.getByTestId('streak-indicator')).toHaveClass('active');
    expect(screen.getByText('5-day streak')).toBeInTheDocument();
    expect(screen.getByText('Played today ✓')).toBeInTheDocument();
  });

  it('urges keeping the streak going when today is not yet played', () => {
    render(StreakIndicator, { streak: { current: 3, longest: 9, playedToday: false } });
    expect(screen.getByText('3-day streak')).toBeInTheDocument();
    expect(screen.getByText('Play today to keep it going')).toBeInTheDocument();
  });

  it('throws no embers on day 1-2, then thickens the shower as the streak climbs', () => {
    expect(emberCount(0)).toBe(0); // no streak — unlit, no embers
    expect(emberCount(2)).toBe(0); // first tier is just the lit flame
    const week = emberCount(7);
    const month = emberCount(30);
    const year = emberCount(365);
    expect(week).toBeGreaterThan(0);
    expect(month).toBeGreaterThan(week);
    expect(year).toBeGreaterThan(month);
  });
});
