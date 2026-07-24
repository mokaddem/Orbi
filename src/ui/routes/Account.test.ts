import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/svelte';

// Controllable identity + prefs stores and spy account actions, so the route is tested in isolation.
// A tiny hand-rolled writable avoids importing svelte in the hoisted block.
const h = vi.hoisted(() => {
  const mk = <T>(init: T) => {
    let v = init;
    const subs = new Set<(x: T) => void>();
    return {
      subscribe(fn: (x: T) => void) {
        subs.add(fn);
        fn(v);
        return () => void subs.delete(fn);
      },
      set(nv: T) {
        v = nv;
        subs.forEach((f) => f(v));
      },
      get: () => v,
    };
  };
  return {
    identity: mk<{
      deviceId: string;
      displayName: string;
      tier: 'anonymous' | 'account';
      email: string | null;
    }>({ deviceId: 'dev-123', displayName: 'Sam', tier: 'anonymous', email: null }),
    prefs: mk<{ playerName: string }>({ playerName: 'Sam' }),
    updatePrefs: vi.fn(),
    renameTo: vi.fn(async () => {}),
    upgrade: vi.fn(async () => ({ ok: true }) as const),
    signIn: vi.fn(async () => ({ ok: true }) as const),
    signOut: vi.fn(async () => {}),
    deleteAccount: vi.fn(async () => ({ ok: true }) as const),
    querystring: '',
  };
});

vi.mock('svelte-spa-router', () => ({
  router: {
    get querystring() {
      return h.querystring;
    },
  },
}));
vi.mock('../stores/identity', () => ({
  identity: h.identity,
  renameTo: h.renameTo,
  upgrade: h.upgrade,
  signIn: h.signIn,
  signOut: h.signOut,
  deleteAccount: h.deleteAccount,
}));
vi.mock('../stores/persistence', () => ({ prefs: h.prefs, updatePrefs: h.updatePrefs }));
vi.mock('../../data', () => ({ PLAYER_NAME_MAX_LENGTH: 24 }));

import Account from './Account.svelte';
import { setLocale } from '../../i18n';

beforeEach(() => {
  setLocale('en');
  h.identity.set({ deviceId: 'dev-123', displayName: 'Sam', tier: 'anonymous', email: null });
  h.querystring = '';
  h.updatePrefs.mockClear();
  h.renameTo.mockClear();
  h.upgrade.mockClear();
  h.signIn.mockClear();
  h.signOut.mockClear();
  h.deleteAccount.mockClear();
});

describe('Account page', () => {
  it('shows the display name field and anonymous create / sign-in actions', () => {
    render(Account);
    expect(screen.getByLabelText('Your name')).toBeInTheDocument();
    expect(screen.getByText('Anonymous (this device)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I already have an account' })).toBeInTheDocument();
  });

  it('renames the display name on change', async () => {
    render(Account);
    await fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ada' } });
    expect(h.renameTo).toHaveBeenCalledWith('Ada');
  });

  it('opens the create-account modal and submits via upgrade', async () => {
    render(Account);
    await fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    const dialog = screen.getByRole('dialog');
    await fireEvent.input(within(dialog).getByLabelText('Email'), {
      target: { value: 'a@b.com' },
    });
    await fireEvent.input(within(dialog).getByLabelText('Password'), {
      target: { value: 'password1' },
    });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Create account' }));
    expect(h.upgrade).toHaveBeenCalledWith('a@b.com', 'password1');
  });

  it('opens the modal straight away from the ?account=signin deep-link', () => {
    h.querystring = 'account=signin';
    render(Account);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Email')).toBeInTheDocument();
  });

  it('shows the signed-in email and deletes via the confirm dialog', async () => {
    h.identity.set({ deviceId: 'dev-123', displayName: 'Sam', tier: 'account', email: 'me@x.com' });
    render(Account);
    expect(screen.getByText('me@x.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    const dialog = screen.getByRole('dialog');
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Delete account' }));
    expect(h.deleteAccount).toHaveBeenCalled();
  });
});
