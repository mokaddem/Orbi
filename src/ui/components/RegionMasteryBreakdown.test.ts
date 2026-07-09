import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import RegionMasteryBreakdown from './RegionMasteryBreakdown.svelte';
import { setLocale } from '../../i18n';
import type { RegionMastery } from '../../domain';

beforeEach(() => setLocale('en'));
afterEach(() => setLocale('en'));

const regions: RegionMastery[] = [
  { region: 'Africa', mastered: 0, learning: 2, unseen: 52, total: 54 },
  { region: 'Europe', mastered: 45, learning: 0, unseen: 0, total: 45 },
];

describe('RegionMasteryBreakdown', () => {
  it('renders one row per region with a localized name and count', () => {
    render(RegionMasteryBreakdown, { regions });
    expect(screen.getByText('Africa')).toBeInTheDocument();
    expect(screen.getByText('Europe')).toBeInTheDocument();
    expect(screen.getByText('0/54')).toBeInTheDocument();
    expect(screen.getByText('45/45')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  });

  it('localizes region names in French', () => {
    setLocale('fr');
    render(RegionMasteryBreakdown, { regions });
    expect(screen.getByText('Afrique')).toBeInTheDocument();
  });
});
