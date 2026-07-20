import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';

// The route reads the deep-link code from svelte-spa-router's reactive `router.querystring`, and
// gates the landing on mastery / Grandmaster storage. Mock both so each test injects a code + the
// receiver's state, then asserts the resolved state and navigation.
const hoisted = vi.hoisted(() => ({
  query: { value: '' as string },
  mastery: { value: null as unknown },
  grandmaster: { value: null as unknown },
  push: vi.fn(),
}));

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

vi.mock('../stores/persistence', () => ({
  storageReady: {
    subscribe: (run: (v: boolean) => void) => {
      run(true);
      return () => {};
    },
  },
  grandmasterKey: (family: string, region: string) => `${family}|${region}`,
  loadMastery: () => Promise.resolve(hoisted.mastery.value),
  loadGrandmaster: () => Promise.resolve(hoisted.grandmaster.value),
}));

import ChallengeInvite from './ChallengeInvite.svelte';
import { challenge, pendingChallenge } from '../stores/challenge';
import { inviteLinkFor } from '../challenge-invite';
import { setLocale } from '../../i18n';

/** A mastery rollup where `family × region` is fully mastered (so the arena is unlocked). */
function masteredMastery(family: string, region: string) {
  return { byRegion: [{ region, families: [{ family, total: 5, mastered: 5 }] }] };
}
const noState = { certified: new Set<string>(), spentToday: new Set<string>() };

/** The querystring for an invite to `family × region` (as `inviteLinkFor` would mint). */
function inviteQuery(family: 'map' | 'flags' | 'capitals', region: string, name = 'Sami'): string {
  return inviteLinkFor(family, region, name).split('?')[1];
}

beforeEach(() => {
  setLocale('en');
  hoisted.query.value = '';
  hoisted.mastery.value = { byRegion: [] };
  hoisted.grandmaster.value = noState;
  hoisted.push.mockClear();
  challenge.reset();
  pendingChallenge.set(null);
});

afterEach(() => {
  challenge.reset();
  pendingChallenge.set(null);
});

describe('ChallengeInvite route (Phase 46b)', () => {
  it('shows a friendly broken state for a missing or corrupt code', () => {
    hoisted.query.value = '';
    render(ChallengeInvite);
    expect(screen.getByText('This invite looks broken')).toBeInTheDocument();

    hoisted.query.value = 'c=not-a-real-code';
    const { container } = render(ChallengeInvite);
    expect(container).toHaveTextContent('This invite looks broken');
  });

  it('shows the LOCKED state when the receiver has not mastered the capstone', async () => {
    hoisted.query.value = inviteQuery('flags', 'Africa');
    hoisted.mastery.value = { byRegion: [] }; // nothing mastered
    render(ChallengeInvite);
    expect(await screen.findByText('Not unlocked yet')).toBeInTheDocument();
    // No "enter the gauntlet" affordance while locked.
    expect(screen.queryByRole('button', { name: 'Enter the gauntlet' })).not.toBeInTheDocument();
  });

  it('offers the run when unlocked, and accepting stages it + routes to the arena', async () => {
    hoisted.query.value = inviteQuery('flags', 'Africa');
    hoisted.mastery.value = masteredMastery('flags', 'Africa');
    render(ChallengeInvite);

    const accept = await screen.findByRole('button', { name: 'Enter the gauntlet' });
    await fireEvent.click(accept);

    expect(hoisted.push).toHaveBeenCalledWith('/challenge');
    expect(get(pendingChallenge)).toEqual({ family: 'flags', region: 'Africa' });
  });

  it('shows the COOLDOWN state when today’s attempt is already spent', async () => {
    hoisted.query.value = inviteQuery('flags', 'Africa');
    hoisted.mastery.value = masteredMastery('flags', 'Africa');
    hoisted.grandmaster.value = {
      certified: new Set<string>(),
      spentToday: new Set(['flags|Africa']),
    };
    render(ChallengeInvite);
    expect(await screen.findByText('Come back tomorrow')).toBeInTheDocument();
  });
});
