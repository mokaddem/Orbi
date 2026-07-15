import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
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

// Grandmaster Run reward (Phase 44): the fully-mastered → prove-it → certified ladder per cell.
describe('FamilyRegionBreakdown — Grandmaster reward', () => {
  // Oceania with Map fully mastered (uncertified), Flags fully mastered (certified), Capitals learning.
  const oceania: RegionFamilyMastery[] = [
    {
      region: 'Oceania',
      families: [
        { family: 'map', mastered: 14, learning: 0, unseen: 0, total: 14 },
        { family: 'flags', mastered: 14, learning: 0, unseen: 0, total: 14 },
        { family: 'capitals', mastered: 7, learning: 4, unseen: 3, total: 14 },
      ],
      fullyMastered: 7,
      inProgress: 4,
      unseen: 3,
      blended: 0.7,
      total: 14,
    },
  ];

  it('shows "prove it" on a fully-mastered-but-uncertified family, practise on a learning one', async () => {
    const onChallenge = vi.fn();
    const onPractise = vi.fn();
    render(FamilyRegionBreakdown, {
      regions: oceania,
      variant: 'stacked',
      certified: new Set(['flags|Oceania']),
      onChallenge,
      onPractise,
    });

    // Map (mastered, uncertified) → a "prove it" launch that fires onChallenge.
    const prove = screen.getByRole('button', { name: /Grandmaster Run for Oceania/ });
    await fireEvent.click(prove);
    expect(onChallenge).toHaveBeenCalledWith('Oceania', 'map');

    // Capitals (still learning) → the practise shortcut is still offered.
    expect(screen.getByRole('button', { name: /Practise/ })).toBeInTheDocument();
  });

  it('gilds a certified family cell (a crown, no launch button) and skips its practise/prove control', () => {
    render(FamilyRegionBreakdown, {
      regions: oceania,
      variant: 'stacked',
      certified: new Set(['flags|Oceania']),
      onChallenge: vi.fn(),
      onPractise: vi.fn(),
    });
    // The certified (Flags) cell shows the crown marker…
    expect(screen.getByLabelText('Grandmaster')).toBeInTheDocument();
    // …and only ONE "prove it" launch exists (Map) — Flags is gilded, not a launch.
    expect(screen.getAllByRole('button', { name: /Grandmaster Run for Oceania/ })).toHaveLength(1);
  });

  it('tags a fully-certified continent as Grandmaster', () => {
    render(FamilyRegionBreakdown, {
      regions: oceania,
      variant: 'stacked',
      certified: new Set(['map|Oceania', 'flags|Oceania', 'capitals|Oceania']),
      onChallenge: vi.fn(),
      onPractise: vi.fn(),
    });
    // Every family certified → the region wears the "Grandmaster" tag, and there are no launches left.
    expect(screen.getByText('Grandmaster')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Grandmaster Run for Oceania/ }),
    ).not.toBeInTheDocument();
  });

  it('offers no prove-it launch without onChallenge (backwards-compatible)', () => {
    render(FamilyRegionBreakdown, { regions: oceania, variant: 'stacked', onPractise: vi.fn() });
    expect(
      screen.queryByRole('button', { name: /Grandmaster Run for Oceania/ }),
    ).not.toBeInTheDocument();
  });
});
