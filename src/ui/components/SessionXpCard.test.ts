import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SessionXpCard from './SessionXpCard.svelte';
import { rankForXp, sessionXp, sessionXpBreakdown, type QuestionResult } from '../../domain';
import { setLocale } from '../../i18n';

beforeEach(() => setLocale('en'));
afterEach(() => setLocale('en'));

function results(n: number, correct: number): QuestionResult[] {
  return Array.from({ length: n }, (_, i) => ({
    itemKey: `flag-to-country:C${i}`,
    countryIso2: `C${i}`,
    correct: i < correct,
    answerMs: 1000,
  }));
}

describe('SessionXpCard', () => {
  it('shows the "+N XP" earned and itemizes the run by source (incl. the streak bonus)', () => {
    // 12 correct in a row → 12·10 + 12·3 + 25 + 50 (streak, crossing 3·5·10) = 231 XP.
    const run = results(12, 12);
    const earned = sessionXp(run);
    render(SessionXpCard, {
      earned,
      breakdown: sessionXpBreakdown(run),
      progress: rankForXp(earned),
      startFraction: 0,
    });

    expect(earned).toBe(231);
    expect(screen.getByTestId('xp-earned')).toHaveTextContent('+231 XP');
    // The source rows, with the session bonus relabelled (not "Sessions played").
    expect(screen.getByText('Correct answers')).toBeInTheDocument();
    expect(screen.getByText('Questions answered')).toBeInTheDocument();
    expect(screen.getByText('Session bonus')).toBeInTheDocument();
    expect(screen.getByText('Streak milestones')).toBeInTheDocument();
    expect(screen.queryByText('Sessions played')).not.toBeInTheDocument();
    // The per-row XP amounts sum to the headline.
    expect(screen.getByText('+120 XP')).toBeInTheDocument();
    expect(screen.getByText('+36 XP')).toBeInTheDocument();
    expect(screen.getByText('+25 XP')).toBeInTheDocument();
    expect(screen.getByText('+50 XP')).toBeInTheDocument();
  });

  it('renders the rank progress bar reporting the current fill, and the total XP', () => {
    // 600 XP → Scout (400 ≤ 600 < 1000 Wanderer); 200 into the 600-wide band → 33%.
    const progress = rankForXp(600);
    render(SessionXpCard, { earned: 100, breakdown: sessionXpBreakdown(results(5, 5)), progress });

    expect(screen.getByText('Scout')).toBeInTheDocument();
    expect(screen.getByText('600 XP total')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
    expect(screen.getByText(/to Wanderer/)).toBeInTheDocument();
  });

  it('drops the "correct" row when the run had no correct answers', () => {
    render(SessionXpCard, {
      earned: 34,
      breakdown: sessionXpBreakdown(results(3, 0)),
      progress: null,
    });
    expect(screen.queryByText('Correct answers')).not.toBeInTheDocument();
    expect(screen.getByText('Questions answered')).toBeInTheDocument();
    expect(screen.getByText('Session bonus')).toBeInTheDocument();
  });

  it('renders the earned breakdown even before the rank snapshot is available', () => {
    render(SessionXpCard, {
      earned: 44,
      breakdown: sessionXpBreakdown(results(3, 1)),
      progress: null,
    });
    expect(screen.getByTestId('xp-earned')).toHaveTextContent('+44 XP');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
