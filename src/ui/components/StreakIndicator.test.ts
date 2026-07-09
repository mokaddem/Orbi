import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import StreakIndicator from './StreakIndicator.svelte';
import { setLocale } from '../../i18n';

beforeEach(() => setLocale('en'));
afterEach(() => setLocale('en'));

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
});
