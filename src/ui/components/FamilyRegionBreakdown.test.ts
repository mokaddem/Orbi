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

describe('FamilyRegionBreakdown — lens tabs', () => {
  it('renders the Overall / Map / Flags / Capitals lens tabs', () => {
    render(FamilyRegionBreakdown, { regions });
    for (const name of ['Overall', 'Map', 'Flags', 'Capitals']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('defaults to the Overall lens — one blended bar per region, no per-family control', () => {
    render(FamilyRegionBreakdown, { regions });
    expect(screen.getByRole('button', { name: 'Overall' })).toHaveAttribute('aria-pressed', 'true');
    // Exactly one progressbar per region, whatever the lens.
    expect(screen.getAllByRole('progressbar')).toHaveLength(regions.length);
  });

  it('does not render a Mastered / Learning key (the bands carry only title tooltips)', () => {
    // Those words exist only as bar `title` attributes, not as visible text — so on touch, where
    // tooltips never appear, the layout stays clean (matching Home's former glance).
    render(FamilyRegionBreakdown, { regions });
    expect(screen.queryByText('Mastered')).not.toBeInTheDocument();
    expect(screen.queryByText('Learning')).not.toBeInTheDocument();
  });
});

// Grandmaster Run reward (Phase 44): the fully-mastered → prove-it → certified ladder rides the
// active family lens — so each assertion first selects the family tab it is about.
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

  it('shows "prove it" on a fully-mastered-but-uncertified family lens', async () => {
    const onChallenge = vi.fn();
    const onPractise = vi.fn();
    render(FamilyRegionBreakdown, {
      regions: oceania,
      certified: new Set(['flags|Oceania']),
      onChallenge,
      onPractise,
    });

    // Map (mastered, uncertified) → a "prove it" launch that fires onChallenge.
    await fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    const prove = screen.getByRole('button', { name: /Grandmaster Run for Oceania/ });
    await fireEvent.click(prove);
    expect(onChallenge).toHaveBeenCalledWith('Oceania', 'map');
  });

  it('offers a practise shortcut on a still-learning family lens', async () => {
    const onPractise = vi.fn();
    render(FamilyRegionBreakdown, { regions: oceania, onPractise });

    // Capitals (7/14, still learning) → the practise shortcut.
    await fireEvent.click(screen.getByRole('button', { name: 'Capitals' }));
    const practise = screen.getByRole('button', { name: /Practise/ });
    await fireEvent.click(practise);
    expect(onPractise).toHaveBeenCalledWith('Oceania', 'capitals');
  });

  it('gilds a certified family lens (a crown, no launch) but launches on an uncertified one', async () => {
    render(FamilyRegionBreakdown, {
      regions: oceania,
      certified: new Set(['flags|Oceania']),
      onChallenge: vi.fn(),
      onPractise: vi.fn(),
    });

    // Flags (certified) → the crown marker, and no "prove it" launch on this lens.
    await fireEvent.click(screen.getByRole('button', { name: 'Flags' }));
    expect(screen.getByLabelText('Grandmaster')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Grandmaster Run for Oceania/ }),
    ).not.toBeInTheDocument();

    // Map (uncertified, fully mastered) → exactly one launch.
    await fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(screen.getAllByRole('button', { name: /Grandmaster Run for Oceania/ })).toHaveLength(1);
  });

  it('tags a fully-certified continent as Grandmaster on any lens, with no launches left', () => {
    render(FamilyRegionBreakdown, {
      regions: oceania,
      certified: new Set(['map|Oceania', 'flags|Oceania', 'capitals|Oceania']),
      onChallenge: vi.fn(),
      onPractise: vi.fn(),
    });
    // The region-level "Grandmaster" tag shows on the default (Overall) lens — a per-region status.
    expect(screen.getByText('Grandmaster')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Grandmaster Run for Oceania/ }),
    ).not.toBeInTheDocument();
  });

  it('offers no prove-it launch without onChallenge (backwards-compatible)', async () => {
    render(FamilyRegionBreakdown, { regions: oceania, onPractise: vi.fn() });
    await fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(
      screen.queryByRole('button', { name: /Grandmaster Run for Oceania/ }),
    ).not.toBeInTheDocument();
  });

  it('shows a cooldown affordance (not the gold "prove it") when today’s attempt is spent', async () => {
    const onChallenge = vi.fn();
    render(FamilyRegionBreakdown, {
      regions: oceania,
      certified: new Set(['flags|Oceania']),
      spent: new Set(['map|Oceania']), // Map is fully mastered, uncertified, but played today
      cooldownText: 'Next attempt in 5h 30m',
      onChallenge,
      onPractise: vi.fn(),
    });

    // On the Map lens the uncertified-but-spent cell reads as the countdown, not the "prove it" launch.
    await fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(
      screen.queryByRole('button', { name: /Grandmaster Run for Oceania/ }),
    ).not.toBeInTheDocument();
    const cool = screen.getByRole('button', { name: 'Next attempt in 5h 30m' });
    // Tapping it still surfaces the (cooldown-gated) offer modal via onChallenge.
    await fireEvent.click(cool);
    expect(onChallenge).toHaveBeenCalledWith('Oceania', 'map');
  });
});
