import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Play from './Play.svelte';
import { play, lastSummary, pendingConfig, playFabAction } from '../stores/game';
import { mulberry32, type Question } from '../../domain';
import { setLocale } from '../../i18n';

function makeClock(): () => number {
  let ms = 0;
  return () => (ms += 1000);
}

/** Feedback auto-advances after these delays (mirrors Play.svelte's constants: CORRECT_MS
 *  for a plain correct answer, REVEAL_MS whenever a reveal is shown — any wrong answer). */
const CORRECT_MS = 1500;
const WRONG_MS = 4500;

beforeEach(() => {
  setLocale('en');
  play.reset();
  lastSummary.set(null);
  pendingConfig.set(null);
  playFabAction.set(null);
});

afterEach(() => {
  play.reset();
  lastSummary.set(null);
  pendingConfig.set(null);
  playFabAction.set(null);
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

  it('publishes a FAB launcher while showing setup, and clears it once playing', async () => {
    expect(get(playFabAction)).toBeNull();
    const { unmount } = render(Play);
    // Setup is showing → the mobile Play FAB has a launch action to run.
    expect(typeof get(playFabAction)).toBe('function');

    await fireEvent.click(screen.getByText('Start'));
    // A session is under way → the FAB reverts to a plain link (no action).
    expect(get(play).status).toBe('playing');
    expect(get(playFabAction)).toBeNull();

    unmount();
    expect(get(playFabAction)).toBeNull();
  });

  it('FAB launch plays the veil flourish, then starts the selected game', async () => {
    const { container } = render(Play);
    // Pick a region so we can assert the launched run used the current selection.
    await fireEvent.click(screen.getByRole('button', { name: 'Europe' }));

    // Press the FAB (its published action). jsdom has no matchMedia and reduceMotion is off,
    // so this takes the animated path: the veil appears and the game hasn't started yet.
    get(playFabAction)!();
    await Promise.resolve();
    const veil = container.querySelector('.launch-veil');
    expect(veil).not.toBeNull();
    expect(get(play).status).toBe('idle');

    // Veil finished wiping in → the game starts underneath (jsdom won't fire animationend itself).
    await fireEvent(veil!, new Event('animationend'));
    expect(get(play).status).toBe('playing');
    expect(get(play).config?.filter).toEqual({ region: 'Europe' });

    // Veil finished fading out → it's removed.
    await fireEvent(container.querySelector('.launch-veil')!, new Event('animationend'));
    expect(container.querySelector('.launch-veil')).toBeNull();
  });

  it('groups modes into families and swaps the direction options when a family is picked', async () => {
    render(Play);

    // Flags is the default family → its two directions are shown; other families' aren't.
    expect(screen.getByText('Flag → Country')).toBeInTheDocument();
    expect(screen.getByText('Country → Flag')).toBeInTheDocument();
    expect(screen.queryByText('Find the highlighted country')).not.toBeInTheDocument();

    // Selecting the Map family reveals its directions and hides the Flags ones.
    await fireEvent.click(screen.getByRole('button', { name: /Map/ }));
    expect(screen.getByText('Find the highlighted country')).toBeInTheDocument();
    expect(screen.getByText('Locate on the map')).toBeInTheDocument();
    expect(screen.queryByText('Flag → Country')).not.toBeInTheDocument();

    // Capitals and Extra families are reachable and reveal their own two directions.
    await fireEvent.click(screen.getByRole('button', { name: /Capitals/ }));
    expect(screen.getByText('Capital → Country')).toBeInTheDocument();
    expect(screen.getByText('Country → Capital')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: /Extra/ }));
    expect(screen.getByText('National languages')).toBeInTheDocument();
    expect(screen.getByText('Main industries')).toBeInTheDocument();
  });

  it('starts an uncapped Grand Tour over the selected region, sized to the pool', async () => {
    render(Play);

    // Pick the Grand Tour format (default Flags → Flag→Country mode) over Europe.
    await fireEvent.click(screen.getByRole('button', { name: /Grand Tour/ }));
    await fireEvent.click(screen.getByRole('button', { name: 'Europe' }));
    await fireEvent.click(screen.getByText('Start'));

    const view = get(play);
    expect(view.status).toBe('playing');
    expect(view.config!.type).toBe('full');
    expect(view.config!.filter).toEqual({ region: 'Europe' });

    // The session is sized to every country in scope (not the fixed-length default of 10),
    // and the HUD counts up to that total; every answer comes from Europe.
    const total = view.config!.fixedLength!;
    expect(total).toBeGreaterThan(10);
    expect(screen.getByText(`Question 1 / ${total}`)).toBeInTheDocument();
    expect(view.question!.answer.region).toBe('Europe');
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

  it('plays country-to-languages: multi-select toggles, then Submit grades all-or-nothing', async () => {
    pendingConfig.set({
      mode: 'country-to-languages',
      type: 'fixed',
      fixedLength: 3,
      rng: mulberry32(11),
      now: makeClock(),
    });
    const { container } = render(Play);

    expect(get(play).status).toBe('playing');
    const q = get(play).question!;
    // Prompt names the country and asks for all its languages; options are language cards.
    expect(container.querySelector('.prompt-name')!.textContent).toBe(q.answer.name.en);
    expect(screen.getByText(/Select all .* languages spoken here/)).toBeInTheDocument();

    // Submit is disabled until at least one option is toggled.
    const submit = () => container.querySelector('.submit-multi') as HTMLButtonElement;
    expect(submit()).toBeDisabled();

    // Toggle every correct language, then submit → graded correct all-or-nothing.
    for (const code of q.correctOptionIds!) {
      await fireEvent.click(container.querySelector(`button[data-id="${code}"]`)!);
    }
    expect(submit()).not.toBeDisabled();
    await fireEvent.click(submit());

    expect(get(play).status).toBe('answered');
    expect(get(play).feedback!.correct).toBe(true);
    expect(get(play).feedback!.pickedIds!.sort()).toEqual([...q.correctOptionIds!].sort());
  });

  it('country-to-languages: an incomplete selection grades wrong and reveals the full set', async () => {
    pendingConfig.set({
      mode: 'country-to-languages',
      type: 'fixed',
      fixedLength: 3,
      rng: mulberry32(11),
      now: makeClock(),
    });
    const { container } = render(Play);
    const q = get(play).question!;

    // Pick only the first correct language (a country may have several) → an incomplete set.
    await fireEvent.click(container.querySelector(`button[data-id="${q.correctOptionIds![0]}"]`)!);
    await fireEvent.click(container.querySelector('.submit-multi')!);

    expect(get(play).feedback!.correct).toBe(q.correctOptionIds!.length === 1);
    // On a miss the reveal lists the country's languages.
    if (q.correctOptionIds!.length > 1) {
      expect(container.querySelector('.reveal')).not.toBeNull();
    }
  });

  it('country-to-industry: a wrong answer reveals the "why" fun fact for the correct industry', async () => {
    // Search seeds for a question whose correct industry carries a curated fact (the priority
    // countries all do). Deterministic: the loop starts from a fixed seed and picks the first hit.
    let container: HTMLElement | null = null;
    let q: Question | null = null;
    let fact: string | undefined;
    for (let seed = 0; seed < 200; seed++) {
      play.reset();
      pendingConfig.set({
        mode: 'country-to-industry',
        type: 'fixed',
        fixedLength: 3,
        rng: mulberry32(seed),
        now: makeClock(),
      });
      const r = render(Play);
      const question = get(play).question!;
      const correct = question.answer.industries.find((i) => i.key === question.correctOptionId);
      if (correct?.fact) {
        container = r.container;
        q = question;
        fact = correct.fact.en;
        break;
      }
      r.unmount();
    }
    expect(fact, 'no covered (country, industry) pairing found in 200 seeds').toBeTruthy();

    // Pick a distractor (any option that is not the correct one) → graded wrong.
    const wrong = q!.attributeOptions!.find((o) => o.id !== q!.correctOptionId)!;
    await fireEvent.click(container!.querySelector(`button[data-id="${wrong.id}"]`)!);
    expect(get(play).feedback!.correct).toBe(false);

    // The reveal shows the "Did you know?" callout with the correct industry's fact.
    const dyk = container!.querySelector('.did-you-know');
    expect(dyk).not.toBeNull();
    expect(dyk!.textContent).toContain('Did you know?');
    expect(dyk!.textContent).toContain(fact!);
  });

  it('country-to-industry: a wrong answer omits the callout when no fact is curated', async () => {
    // Find a pairing whose correct industry has NO fact (the uncovered long tail) → graceful omit.
    let container: HTMLElement | null = null;
    let q: Question | null = null;
    for (let seed = 0; seed < 200; seed++) {
      play.reset();
      pendingConfig.set({
        mode: 'country-to-industry',
        type: 'fixed',
        fixedLength: 3,
        rng: mulberry32(seed),
        now: makeClock(),
      });
      const r = render(Play);
      const question = get(play).question!;
      const correct = question.answer.industries.find((i) => i.key === question.correctOptionId);
      if (correct && !correct.fact) {
        container = r.container;
        q = question;
        break;
      }
      r.unmount();
    }
    expect(q, 'no uncovered pairing found in 200 seeds').not.toBeNull();

    const wrong = q!.attributeOptions!.find((o) => o.id !== q!.correctOptionId)!;
    await fireEvent.click(container!.querySelector(`button[data-id="${wrong.id}"]`)!);
    expect(get(play).feedback!.correct).toBe(false);

    // The industries list still reveals, but there is no "Did you know?" callout.
    expect(container!.querySelector('.reveal')).not.toBeNull();
    expect(container!.querySelector('.did-you-know')).toBeNull();
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

  it('renders survival lives as heart glyphs, dimming one per wrong answer', async () => {
    pendingConfig.set({
      mode: 'map-highlight',
      type: 'survival',
      lives: 3,
      rng: mulberry32(3),
      now: makeClock(),
    });
    const { container } = render(Play);
    expect(get(play).status).toBe('playing');

    // Three hearts, none lost yet.
    expect(container.querySelectorAll('.lives .heart').length).toBe(3);
    expect(container.querySelectorAll('.lives .heart.lost').length).toBe(0);

    // A wrong answer costs a life → one dimmed heart.
    const q = get(play).question!;
    const wrong = q.options!.find((o) => o.iso2 !== q.answer.iso2)!;
    await fireEvent.click(container.querySelector(`button[data-id="${wrong.iso2}"]`)!);
    expect(container.querySelectorAll('.lives .heart.lost').length).toBe(1);
  });

  it('shows the correct country flag in the wrong-answer reveal (map-highlight)', async () => {
    pendingConfig.set({
      mode: 'map-highlight',
      type: 'fixed',
      fixedLength: 3,
      rng: mulberry32(3),
      now: makeClock(),
    });
    const { container } = render(Play);

    const q = get(play).question!;
    const wrong = q.options!.find((o) => o.iso2 !== q.answer.iso2)!;
    await fireEvent.click(container.querySelector(`button[data-id="${wrong.iso2}"]`)!);
    expect(get(play).status).toBe('answered');
    // The reveal carries the correct country's flag beside the name.
    expect(container.querySelector('.reveal-line .reveal-flag img')).toBeInTheDocument();
  });

  it('anchors an attribute-mode prompt with the country flag (country-to-capital)', () => {
    pendingConfig.set({
      mode: 'country-to-capital',
      type: 'fixed',
      fixedLength: 3,
      rng: mulberry32(8),
      now: makeClock(),
    });
    const { container } = render(Play);
    expect(container.querySelector('.prompt .prompt-country-flag img')).toBeInTheDocument();
  });

  it('does not add a prompt flag to country-to-flag (it would leak the answer)', () => {
    pendingConfig.set({
      mode: 'country-to-flag',
      type: 'fixed',
      fixedLength: 3,
      rng: mulberry32(8),
      now: makeClock(),
    });
    const { container } = render(Play);
    expect(container.querySelector('.prompt-country-flag')).toBeNull();
  });
});
