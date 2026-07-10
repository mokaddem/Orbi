import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import WeeklyRecap from './WeeklyRecap.svelte';
import { setLocale } from '../../i18n';
import type { WeeklyRecap as WeeklyRecapData } from '../../domain';

beforeEach(() => setLocale('en'));
afterEach(() => setLocale('en'));

const empty: WeeklyRecapData = {
  weekStart: 0,
  sessions: 0,
  questions: 0,
  correct: 0,
  accuracy: 0,
  masteredThisWeek: 0,
  currentStreak: 0,
  longestStreak: 0,
};

describe('WeeklyRecap', () => {
  it('nudges the player when nothing was played this week', () => {
    render(WeeklyRecap, { recap: empty });
    expect(screen.getByTestId('weekly-recap')).toHaveAttribute('data-empty', 'true');
    expect(screen.getByText(/Nothing yet this week/)).toBeInTheDocument();
  });

  it('shows the week chips when there was play', () => {
    render(WeeklyRecap, {
      recap: {
        ...empty,
        sessions: 4,
        questions: 40,
        correct: 34,
        accuracy: 0.85,
        masteredThisWeek: 6,
        currentStreak: 3,
      },
    });
    const el = screen.getByTestId('weekly-recap');
    expect(el).toHaveAttribute('data-empty', 'false');
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('+6')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    // Each of the five chips carries a leading icon (Phase 31 visual sweep).
    expect(el.querySelectorAll('.chip .icon').length).toBe(5);
  });
});
