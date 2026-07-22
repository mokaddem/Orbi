import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Play from './Play.svelte';
import { play, lastSummary, pendingConfig, pendingDuel } from '../stores/game';
import { pendingInboxDuelId } from '../stores/duels';
import { mulberry32, type DuelPayload } from '../../domain';
import { setLocale } from '../../i18n';

function makeClock(): () => number {
  let ms = 0;
  return () => (ms += 1000);
}

// Mirrors the inbox accept: an explicit `seed` (which play.start stamps onto the summary) reproduces
// the duel; without one, an ad-hoc rng drives an ordinary run.
function startRun(seed?: number): void {
  pendingConfig.set({
    mode: 'flag-to-country',
    type: 'fixed',
    fixedLength: 10,
    choices: 4,
    ...(seed !== undefined ? { seed } : { rng: mulberry32(1) }),
    now: makeClock(),
  });
}

const challenge: DuelPayload = {
  protocolVersion: 1,
  dataVersion: 'test',
  mode: 'flag-to-country',
  type: 'fixed',
  region: 'Europe',
  length: 10,
  choices: 4,
  seed: 0x1234,
  challengerName: 'Alice',
  challengerScore: { primary: 9, tiebreak: 1000 },
};

beforeEach(() => {
  setLocale('en');
  play.reset();
  lastSummary.set(null);
  pendingConfig.set(null);
  pendingDuel.set(null);
  pendingInboxDuelId.set(null);
});

afterEach(() => {
  play.reset();
  lastSummary.set(null);
  pendingConfig.set(null);
  pendingDuel.set(null);
  pendingInboxDuelId.set(null);
});

describe('Play — quitting a received inbox duel (Phase 54)', () => {
  it('an ordinary run quits instantly (no confirm) and discards', async () => {
    startRun();
    render(Play);
    expect(get(play).status).toBe('playing');

    await fireEvent.click(screen.getByRole('button', { name: 'Quit' }));

    // No inbox duel → no confirmation, the run is discarded back to setup.
    expect(screen.queryByText('Quit this duel?')).not.toBeInTheDocument();
    expect(get(play).status).toBe('idle');
  });

  it('an inbox duel confirms, then ends the run so the Summary can submit the partial score', async () => {
    pendingDuel.set(challenge);
    pendingInboxDuelId.set('d1');
    startRun(0x1234);
    render(Play);
    expect(get(play).status).toBe('playing');

    await fireEvent.click(screen.getByRole('button', { name: 'Quit' }));

    // The confirmation names the challenger and warns the score will be sent.
    expect(screen.getByText('Quit this duel?')).toBeInTheDocument();
    expect(screen.getByText('Your current score will be sent to Alice.')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Quit & send score' }));

    // The run is finished with its progress so far and handed to the Summary (which writes the row).
    expect(get(play).status).toBe('finished');
    expect(get(lastSummary)).not.toBeNull();
    expect(get(lastSummary)?.seed).toBe(0x1234);
  });

  it('keeping playing dismisses the confirm and leaves the run running', async () => {
    pendingDuel.set(challenge);
    pendingInboxDuelId.set('d1');
    startRun(0x1234);
    render(Play);

    await fireEvent.click(screen.getByRole('button', { name: 'Quit' }));
    expect(screen.getByText('Quit this duel?')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(screen.queryByText('Quit this duel?')).not.toBeInTheDocument();
    expect(get(play).status).toBe('playing');
  });
});
