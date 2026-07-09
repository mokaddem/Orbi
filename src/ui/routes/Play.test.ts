import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Play from './Play.svelte';
import { play, lastSummary, pendingConfig } from '../stores/game';
import { mulberry32 } from '../../domain';
import { setLocale } from '../../i18n';

function makeClock(): () => number {
  let ms = 0;
  return () => (ms += 1000);
}

/** Feedback auto-advances after these delays (mirrors Play.svelte's constants). */
const CORRECT_MS = 1500;
const WRONG_MS = 3000;

beforeEach(() => {
  setLocale('en');
  play.reset();
  lastSummary.set(null);
  pendingConfig.set(null);
});

afterEach(() => {
  play.reset();
  lastSummary.set(null);
  pendingConfig.set(null);
});

describe('Play route', () => {
  it('shows the setup screen and starts a game on demand', async () => {
    render(Play);
    // Mode + format choices are offered.
    expect(screen.getByText('Flag → Country')).toBeInTheDocument();
    expect(screen.getByText('Country → Flag')).toBeInTheDocument();

    await fireEvent.click(screen.getByText('Start'));

    // The game HUD is now showing a progress counter.
    expect(get(play).status).toBe('playing');
    expect(screen.getByText(/Question 1 \/ 10/)).toBeInTheDocument();
  });

  it('offers all six modes on the setup screen', () => {
    render(Play);
    expect(screen.getByText('Flag → Country')).toBeInTheDocument();
    expect(screen.getByText('Country → Flag')).toBeInTheDocument();
    expect(screen.getByText('Find the highlighted country')).toBeInTheDocument();
    expect(screen.getByText('Locate on the map')).toBeInTheDocument();
    expect(screen.getByText('Capital → Country')).toBeInTheDocument();
    expect(screen.getByText('Country → Capital')).toBeInTheDocument();
  });

  it('offers the region filter as buttons (few options) and starts a region-filtered session', async () => {
    render(Play);
    // World is the default selection, rendered as a pressed button (not a dropdown).
    const worldBtn = screen.getByRole('button', { name: 'World' });
    expect(worldBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Europe' })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Europe' }));
    await fireEvent.click(screen.getByText('Start'));

    expect(get(play).status).toBe('playing');
    expect(get(play).config!.filter).toEqual({ region: 'Europe' });
    expect(get(play).question!.answer.region).toBe('Europe');
  });

  it('reveals sub-region buttons once a region is chosen', async () => {
    render(Play);
    // No sub-region buttons until a region is picked.
    expect(screen.queryByRole('button', { name: 'Eastern Europe' })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Europe' }));
    expect(screen.getByRole('button', { name: 'Eastern Europe' })).toBeInTheDocument();

    // Narrowing to a sub-region carries through to the started session.
    await fireEvent.click(screen.getByRole('button', { name: 'Eastern Europe' }));
    await fireEvent.click(screen.getByText('Start'));
    expect(get(play).config!.filter).toEqual({ region: 'Europe', subregion: 'Eastern Europe' });
  });

  it('hides the sub-region selector for a region with a single bucket (Oceania)', async () => {
    render(Play);
    // Europe is subdivided, so its "All of …" sub-region option is shown.
    await fireEvent.click(screen.getByRole('button', { name: 'Europe' }));
    expect(screen.getByRole('button', { name: 'All of Europe' })).toBeInTheDocument();

    // Oceania (post-Phase-19) has a single bucket, so no sub-region control renders.
    await fireEvent.click(screen.getByRole('button', { name: 'Oceania' }));
    expect(screen.queryByRole('button', { name: 'All of Oceania' })).not.toBeInTheDocument();

    // Starting plays the whole region — the filter carries no sub-region.
    await fireEvent.click(screen.getByText('Start'));
    expect(get(play).config!.filter).toEqual({ region: 'Oceania' });
    expect(get(play).question!.answer.region).toBe('Oceania');
  });

  it('plays a map-highlight fixed session, auto-advancing between questions', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      pendingConfig.set({
        mode: 'map-highlight',
        type: 'fixed',
        fixedLength: 2,
        rng: mulberry32(3),
        now: makeClock(),
      });
      const { container } = render(Play);

      expect(get(play).status).toBe('playing');
      expect(screen.getByText('Which country is highlighted?')).toBeInTheDocument();

      for (let i = 0; i < 2; i++) {
        const answerIso = get(play).question!.answer.iso2;
        await fireEvent.click(container.querySelector(`button[data-id="${answerIso}"]`)!);
        expect(get(play).status).toBe('answered');
        // No manual Continue button; a countdown drives the auto-advance.
        expect(container.querySelector('button.continue')).toBeNull();
        expect(container.querySelector('.countdown')).not.toBeNull();
        await vi.advanceTimersByTimeAsync(CORRECT_MS + 100);
      }

      const summary = get(lastSummary);
      expect(summary).not.toBeNull();
      expect(summary!.mode).toBe('map-highlight');
      expect(summary!.total).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('plays capital-to-country: the prompt is a capital, options are countries', async () => {
    pendingConfig.set({
      mode: 'capital-to-country',
      type: 'fixed',
      fixedLength: 3,
      rng: mulberry32(4),
      now: makeClock(),
    });
    const { container } = render(Play);

    expect(get(play).status).toBe('playing');
    expect(screen.getByText("Which country's capital is this?")).toBeInTheDocument();

    const q = get(play).question!;
    // The prompt shows the answer country's (English) capital.
    expect(container.querySelector('.prompt-name')!.textContent).toBe(q.answer.capital.en);
    // Options are countries: picking the answer country's ISO2 grades correct.
    const correct = container.querySelector(`button[data-id="${q.answer.iso2}"]`)!;
    expect(correct).not.toBeNull();
    await fireEvent.click(correct);
    expect(get(play).status).toBe('answered');
    expect(get(play).feedback!.correct).toBe(true);
  });

  it('plays country-to-capital: the prompt is a country, options are capitals graded by id', async () => {
    pendingConfig.set({
      mode: 'country-to-capital',
      type: 'fixed',
      fixedLength: 3,
      rng: mulberry32(8),
      now: makeClock(),
    });
    const { container } = render(Play);

    expect(get(play).status).toBe('playing');
    expect(screen.getByText('Which is its capital?')).toBeInTheDocument();

    const q = get(play).question!;
    // Prompt shows the country name; the correct capital appears among the options.
    expect(container.querySelector('.prompt-name')!.textContent).toBe(q.answer.name.en);
    const labels = [...container.querySelectorAll('.opt-name')].map((e) => e.textContent);
    expect(labels).toContain(q.answer.capital.en);
    // The correct option carries the owning country's ISO2 as its id.
    const correct = container.querySelector(`button[data-id="${q.correctOptionId}"]`)!;
    expect(correct).not.toBeNull();
    await fireEvent.click(correct);
    expect(get(play).status).toBe('answered');
    expect(get(play).feedback!.correct).toBe(true);
  });

  it('auto-starts a staged config and plays a fixed session end-to-end via the timer', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      pendingConfig.set({
        mode: 'flag-to-country',
        type: 'fixed',
        fixedLength: 2,
        rng: mulberry32(7),
        now: makeClock(),
      });
      const { container } = render(Play);

      expect(get(play).status).toBe('playing');

      for (let i = 0; i < 2; i++) {
        const answerIso = get(play).question!.answer.iso2;
        await fireEvent.click(container.querySelector(`button[data-id="${answerIso}"]`)!);
        expect(get(play).status).toBe('answered');
        await vi.advanceTimersByTimeAsync(CORRECT_MS + 100);
      }

      // The final question auto-advances straight to the summary — no click needed.
      const summary = get(lastSummary);
      expect(summary).not.toBeNull();
      expect(summary!.total).toBe(2);
      expect(summary!.correct).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('dwells longer on a wrong answer than a correct one before advancing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      pendingConfig.set({
        mode: 'flag-to-country',
        type: 'fixed',
        fixedLength: 5,
        rng: mulberry32(11),
        now: makeClock(),
      });
      const { container } = render(Play);

      // Q1 — correct: advances at ~CORRECT_MS.
      let q = get(play).question!;
      await fireEvent.click(container.querySelector(`button[data-id="${q.answer.iso2}"]`)!);
      expect(get(play).status).toBe('answered');
      await vi.advanceTimersByTimeAsync(CORRECT_MS - 100);
      expect(get(play).status).toBe('answered'); // not yet
      await vi.advanceTimersByTimeAsync(200);
      expect(get(play).status).toBe('playing'); // advanced

      // Q2 — wrong: still waiting at CORRECT_MS, only advances near WRONG_MS.
      q = get(play).question!;
      const wrong = q.options!.find((o) => o.iso2 !== q.answer.iso2)!;
      await fireEvent.click(container.querySelector(`button[data-id="${wrong.iso2}"]`)!);
      expect(get(play).status).toBe('answered');
      await vi.advanceTimersByTimeAsync(CORRECT_MS + 100);
      expect(get(play).status).toBe('answered'); // wrong dwells longer than a correct answer
      await vi.advanceTimersByTimeAsync(WRONG_MS - CORRECT_MS);
      expect(get(play).status).toBe('playing'); // advanced after ~WRONG_MS
    } finally {
      vi.useRealTimers();
    }
  });
});
