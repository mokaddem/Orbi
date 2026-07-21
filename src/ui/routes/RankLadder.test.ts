import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import RankLadder from './RankLadder.svelte';
import { RANKS } from '../../domain';
import { setLocale } from '../../i18n';

beforeEach(() => {
  setLocale('en');
});

describe('RankLadder route', () => {
  it('renders one live medal per rank — so it can never drift from the game', () => {
    const { container } = render(RankLadder);
    // RankMedal draws an <svg class="medal">; one per rank in the domain table.
    expect(container.querySelectorAll('svg.medal').length).toBe(RANKS.length);
  });

  it('shows every rank name and its XP threshold', () => {
    render(RankLadder);
    expect(screen.getByText('Novice')).toBeInTheDocument();
    expect(screen.getByText('Legendary Explorer')).toBeInTheDocument();
    // Thresholds are rendered live from RANKS (Scout = 400, Legend = 240,000) — bare XP, no prefix.
    expect(screen.getByText('400 XP')).toBeInTheDocument();
    expect(screen.getByText('240,000 XP')).toBeInTheDocument();
    // The starting rank shows no threshold, just the "starting rank" label.
    expect(screen.getByText('Starting rank')).toBeInTheDocument();
  });

  it('groups the ladder by metal band', () => {
    render(RankLadder);
    for (const band of ['Bronze', 'Silver', 'Gold', 'Platinum', 'Crystal']) {
      expect(screen.getByText(band)).toBeInTheDocument();
    }
  });
});
