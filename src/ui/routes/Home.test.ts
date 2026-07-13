import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, beforeEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Home from './Home.svelte';
import { pendingConfig, play } from '../stores/game';
import { initPersistence, recordAnswer } from '../stores/persistence';
import { setLocale } from '../../i18n';

beforeAll(async () => {
  await initPersistence();
});

beforeEach(() => {
  setLocale('en');
  play.reset();
  pendingConfig.set(null);
});

afterEach(() => {
  play.reset();
  pendingConfig.set(null);
});

describe('Home route — review hero (Phase 26 region-scoped)', () => {
  // Runs first, before any SR items are seeded, so the store has nothing to review.
  it('shows the fresh-start card and no review list on an empty profile', async () => {
    render(Home);
    // The card always renders (never empty); with no data it is the fresh-start fallback.
    const card = await screen.findByTestId('next-up-card');
    expect(card).toHaveAttribute('data-kind', 'fresh-start');
    expect(screen.getByRole('heading', { name: 'Ready to play' })).toBeInTheDocument();
    // With nothing to review, neither a region row nor the "review everything" escape hatch shows.
    expect(screen.queryByRole('button', { name: /Review everything/ })).not.toBeInTheDocument();

    // Phase 15: with no history the streak nudges a start, and the Daily Challenge is
    // present and not-yet-done.
    const streak = await screen.findByTestId('streak-indicator');
    expect(streak).toHaveTextContent('Start a streak today');
    const daily = await screen.findByTestId('daily-card');
    expect(daily).toHaveAttribute('data-done', 'false');
  });

  it('surfaces a region-scoped review list once mistakes exist', async () => {
    // Record a couple of missed map-highlight items in Europe — a miss is due immediately.
    await recordAnswer({
      itemKey: 'map-highlight:BG',
      countryIso2: 'BG',
      correct: false,
      answerMs: 700,
    });
    await recordAnswer({
      itemKey: 'map-highlight:RO',
      countryIso2: 'RO',
      correct: false,
      answerMs: 700,
    });

    render(Home);

    // The most-urgent region (Europe) is offered as a scoped review; clicking it stages a
    // training run limited to that region's items — no foreign-region items leak in.
    const europe = await screen.findByRole('button', { name: /Europe/ });
    await fireEvent.click(europe);

    let cfg = get(pendingConfig);
    expect(cfg).toMatchObject({ mode: 'map-highlight', type: 'training' });
    expect(cfg!.answerPoolIso?.slice().sort()).toEqual(['BG', 'RO']);
    expect(cfg!.fixedLength).toBe(2);

    // The global "review everything" escape hatch remains one tap away.
    pendingConfig.set(null);
    const everything = await screen.findByRole('button', { name: /Review everything \(\d+\)/ });
    await fireEvent.click(everything);
    cfg = get(pendingConfig);
    expect(cfg).toMatchObject({ mode: 'map-highlight', type: 'training' });
    expect(cfg!.answerPoolIso?.slice().sort()).toEqual(['BG', 'RO']);
  });
});

describe('Home route — mastery region breakdown (Phase 29)', () => {
  it('collapses by default and toggles the per-region breakdown', async () => {
    render(Home);

    // The compact per-family world-mastery meter is on Home...
    await screen.findByTestId('family-mastery-meter');

    // ...and its per-region breakdown is hidden by default: the trigger advertises "show"
    // and reports aria-expanded=false, with no region rows in the DOM yet.
    expect(screen.queryByTestId('family-region-mastery')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Show per-region breakdown' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'home-region-breakdown');

    // Expanding reveals the per-family region breakdown (one row per M49 region), and the
    // trigger flips to the "hide" affordance with aria-expanded=true. The toggle variant
    // carries a progressbar per region (one bar, driven by the family lens).
    await fireEvent.click(toggle);
    const breakdown = await screen.findByTestId('family-region-mastery');
    expect(document.getElementById('home-region-breakdown')).toContainElement(breakdown);
    expect(within(breakdown).getAllByRole('progressbar').length).toBeGreaterThan(0);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Hide per-region breakdown' })).toBe(toggle);

    // Collapsing again hides it: aria-expanded flips back and the region rows leave the DOM.
    await fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() =>
      expect(screen.queryByTestId('family-region-mastery')).not.toBeInTheDocument(),
    );
  });
});
