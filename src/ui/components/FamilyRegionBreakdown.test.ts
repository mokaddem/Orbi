import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import FamilyRegionBreakdown from './FamilyRegionBreakdown.svelte';
import { setLocale } from '../../i18n';
import type { RegionFamilyMastery } from '../../domain';

beforeEach(() => setLocale('en'));
afterEach(() => setLocale('en'));

const regions: RegionFamilyMastery[] = [
  {
    region: 'Europe',
    families: [
      { family: 'map', mastered: 2, learning: 1, unseen: 2, total: 5 },
      { family: 'flags', mastered: 1, learning: 2, unseen: 2, total: 5 },
      { family: 'capitals', mastered: 0, learning: 3, unseen: 2, total: 5 },
    ],
    fullyMastered: 1,
    inProgress: 3,
    unseen: 1,
    blended: 0.3,
    total: 5,
  },
];

describe('FamilyRegionBreakdown', () => {
  it('shows a visible Mastered / Learning key in the stacked (Progress) variant', () => {
    // The solid vs striped band was otherwise explained only by title tooltips, which never
    // appear on touch devices — so the key must render as real text on mobile.
    render(FamilyRegionBreakdown, { regions, variant: 'stacked' });
    expect(screen.getByText('Mastered')).toBeInTheDocument();
    expect(screen.getByText('Learning')).toBeInTheDocument();
  });

  it('does not render the key in the toggle (Home) variant', () => {
    render(FamilyRegionBreakdown, { regions, variant: 'toggle' });
    // In the toggle variant those words exist only as bar `title` attributes, not as text.
    expect(screen.queryByText('Mastered')).not.toBeInTheDocument();
    expect(screen.queryByText('Learning')).not.toBeInTheDocument();
  });

  it('localizes the key (FR)', () => {
    setLocale('fr');
    render(FamilyRegionBreakdown, { regions, variant: 'stacked' });
    expect(screen.getByText('Maîtrisé')).toBeInTheDocument();
    expect(screen.getByText('En cours')).toBeInTheDocument();
  });
});
