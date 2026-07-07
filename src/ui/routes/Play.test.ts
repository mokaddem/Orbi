import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
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

  it('offers all four modes on the setup screen', () => {
    render(Play);
    expect(screen.getByText('Flag → Country')).toBeInTheDocument();
    expect(screen.getByText('Country → Flag')).toBeInTheDocument();
    expect(screen.getByText('Find the highlighted country')).toBeInTheDocument();
    expect(screen.getByText('Locate on the map')).toBeInTheDocument();
  });

  it('defaults the region filter to World and starts a region-filtered session', async () => {
    render(Play);
    const regionSelect = screen.getByRole('combobox', {
      name: 'Choose a region',
    }) as HTMLSelectElement;
    expect(regionSelect.value).toBe(''); // World (all countries)
    expect(screen.getByRole('option', { name: 'World (all countries)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Europe' })).toBeInTheDocument();

    await fireEvent.change(regionSelect, { target: { value: 'Europe' } });
    await fireEvent.click(screen.getByText('Start'));

    expect(get(play).status).toBe('playing');
    expect(get(play).config!.filter).toEqual({ region: 'Europe' });
    expect(get(play).question!.answer.region).toBe('Europe');
  });

  it('reveals sub-regions once a region is chosen', async () => {
    render(Play);
    const regionSelect = screen.getByRole('combobox', {
      name: 'Choose a region',
    }) as HTMLSelectElement;
    // No sub-region options until a region is picked.
    expect(screen.queryByRole('option', { name: 'Eastern Europe' })).not.toBeInTheDocument();

    await fireEvent.change(regionSelect, { target: { value: 'Europe' } });
    expect(screen.getByRole('option', { name: 'Eastern Europe' })).toBeInTheDocument();

    // Narrowing to a sub-region carries through to the started session.
    const subSelect = screen.getByRole('combobox', { name: 'Europe' }) as HTMLSelectElement;
    await fireEvent.change(subSelect, { target: { value: 'Eastern Europe' } });
    await fireEvent.click(screen.getByText('Start'));
    expect(get(play).config!.filter).toEqual({ region: 'Europe', subregion: 'Eastern Europe' });
  });

  it('plays a map-highlight fixed session via the choice grid', async () => {
    pendingConfig.set({
      mode: 'map-highlight',
      type: 'fixed',
      fixedLength: 2,
      rng: mulberry32(3),
      now: makeClock(),
    });
    const { container } = render(Play);

    expect(get(play).status).toBe('playing');
    // map-highlight asks for the name and still offers multiple-choice options.
    expect(screen.getByText('Which country is highlighted?')).toBeInTheDocument();

    for (let i = 0; i < 2; i++) {
      const answerIso = get(play).question!.answer.iso2;
      await fireEvent.click(container.querySelector(`button[data-iso="${answerIso}"]`)!);
      expect(get(play).status).toBe('answered');
      await fireEvent.click(container.querySelector('button.continue')!);
    }

    const summary = get(lastSummary);
    expect(summary).not.toBeNull();
    expect(summary!.mode).toBe('map-highlight');
    expect(summary!.total).toBe(2);
  });

  it('auto-starts a staged config and plays a fixed session end-to-end', async () => {
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
      await fireEvent.click(container.querySelector(`button[data-iso="${answerIso}"]`)!);
      expect(get(play).status).toBe('answered');
      await fireEvent.click(container.querySelector('button.continue')!);
    }

    // The session finished and handed a summary to the Summary route.
    const summary = get(lastSummary);
    expect(summary).not.toBeNull();
    expect(summary!.total).toBe(2);
    expect(summary!.correct).toBe(2);
  });
});
