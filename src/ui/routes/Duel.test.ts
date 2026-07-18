import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';

// The Duel route reads the deep-link code from svelte-spa-router's reactive `router.querystring`.
// Mock it so each test can inject a `#/duel?c=…` / `?r=…` query and assert navigation.
const hoisted = vi.hoisted(() => ({ query: { value: '' as string }, push: vi.fn() }));
vi.mock('svelte-spa-router', () => ({
  get router() {
    return {
      get querystring() {
        return hoisted.query.value;
      },
    };
  },
  push: hoisted.push,
}));

import Duel from './Duel.svelte';
import { pendingConfig, pendingDuel } from '../stores/game';
import { buildDuelPayload, buildReturnPayload } from '../duel';
import { encodeDuel, type SessionSummary } from '../../domain';
import { setLocale } from '../../i18n';

function summary(over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    mode: 'flag-to-country',
    type: 'fixed',
    regionFilter: { region: 'Europe' },
    total: 12,
    correct: 8,
    accuracy: 8 / 12,
    bestStreak: 4,
    startedAt: 1000,
    finishedAt: 61000,
    durationMs: 60000,
    missed: [],
    results: [],
    choices: 4,
    seed: 0x1234,
    ...over,
  };
}

function challengeCode(name = 'Sami'): string {
  return encodeDuel(buildDuelPayload(summary({ correct: 5 }), name)!);
}

beforeEach(() => {
  setLocale('en');
  hoisted.query.value = '';
  hoisted.push.mockClear();
  pendingConfig.set(null);
  pendingDuel.set(null);
});

afterEach(() => {
  pendingConfig.set(null);
  pendingDuel.set(null);
});

describe('Duel route (Phase 46)', () => {
  it('shows a friendly broken state for a missing or corrupt code', () => {
    hoisted.query.value = '';
    render(Duel);
    expect(screen.getByText('This challenge link looks broken')).toBeInTheDocument();

    hoisted.query.value = 'c=not-a-real-code';
    const { container } = render(Duel);
    expect(container).toHaveTextContent('This challenge link looks broken');
  });

  it('renders an incoming challenge with the challenger, scope and target', () => {
    hoisted.query.value = `c=${challengeCode('Sami')}`;
    render(Duel);
    expect(screen.getByText('Sami challenges you!')).toBeInTheDocument();
    // Scope line + target (challenger scored 5 correct).
    expect(screen.getByText('Beat 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept & play' })).toBeInTheDocument();
  });

  it('accepting stages the identical seeded run + the pending duel, then routes to Play', async () => {
    hoisted.query.value = `c=${challengeCode('Sami')}`;
    render(Duel);

    await fireEvent.click(screen.getByRole('button', { name: 'Accept & play' }));

    expect(hoisted.push).toHaveBeenCalledWith('/play');
    const cfg = get(pendingConfig);
    expect(cfg).toMatchObject({
      mode: 'flag-to-country',
      type: 'fixed',
      filter: { region: 'Europe' },
      fixedLength: 12,
      choices: 4,
      seed: 0x1234,
    });
    // The challenge is stashed so the Summary can show the verdict on finish.
    expect(get(pendingDuel)?.seed).toBe(0x1234);
  });

  it('renders the return leg with the head-to-head verdict', () => {
    // Challenger (viewer) scored 8; responder scored 3 → the challenger wins.
    const challenge = buildDuelPayload(summary({ correct: 8 }), 'Sami')!;
    const ret = buildReturnPayload(challenge, 'Alex', summary({ correct: 3 }));
    hoisted.query.value = `r=${encodeDuel(ret)}`;
    render(Duel);
    expect(screen.getByText('Alex took your challenge')).toBeInTheDocument();
    expect(screen.getByText('You win!')).toBeInTheDocument();
  });
});
