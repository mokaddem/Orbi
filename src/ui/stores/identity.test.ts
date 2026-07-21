import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type { Prefs } from '../../data';
import type { Writable } from 'svelte/store';

// Mock the two backend seams so the orchestration is tested with NO network / no live
// server (CI never needs PocketBase — the real flow is covered by a documented manual
// smoke). And mock persistence so the durable deviceId/secret + playerName are
// controllable in-memory.

const backend = vi.hoisted(() => ({
  currentProfile: vi.fn(),
  ensureAnonymous: vi.fn(),
  registerAccount: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  updateDisplayName: vi.fn(),
  deleteSelf: vi.fn(),
}));

vi.mock('../../backend/client', () => ({
  isBackendConfigured: vi.fn(() => true),
}));

vi.mock('../../backend/identity', () => backend);

// In-memory persistence double. A minimal Svelte-compatible writable is built INSIDE the
// hoisted factory (it runs before imports, so it can't reference the svelte import).
const store = vi.hoisted(() => {
  function makeWritable<T>(initial: T): Writable<T> {
    let value = initial;
    const subs = new Set<(v: T) => void>();
    const set = (v: T) => {
      value = v;
      subs.forEach((f) => f(value));
    };
    return {
      subscribe(fn: (v: T) => void) {
        subs.add(fn);
        fn(value);
        return () => subs.delete(fn);
      },
      set,
      update: (fn: (v: T) => T) => set(fn(value)),
    } as Writable<T>;
  }
  return {
    identityRecord: undefined as { deviceId: string; anonSecret?: string } | undefined,
    prefs: makeWritable<Prefs>({ language: 'en' } as Prefs),
  };
});

vi.mock('./persistence', () => ({
  prefs: store.prefs,
  updatePrefs: (patch: Partial<Prefs>) => store.prefs.update((p) => ({ ...p, ...patch })),
  getStoredIdentity: vi.fn(async () => store.identityRecord),
  saveStoredIdentity: vi.fn(async (rec: { deviceId: string; anonSecret?: string }) => {
    store.identityRecord = { ...rec };
  }),
}));

import { isBackendConfigured } from '../../backend/client';
import {
  identity,
  initIdentity,
  ensureServerIdentity,
  renameTo,
  upgrade,
  signIn,
  signOut,
  deleteAccount,
  __resetIdentityForTests,
} from './identity';

const configured = vi.mocked(isBackendConfigured);

const anonProfile = {
  id: 'rec-anon',
  displayName: '',
  deviceId: 'd',
  isAnonymous: true,
  email: '',
};
const acctProfile = {
  id: 'rec-real',
  displayName: 'Nomad',
  deviceId: 'd',
  isAnonymous: false,
  email: 'me@example.com',
};

beforeEach(() => {
  configured.mockReturnValue(true);
  store.identityRecord = undefined;
  store.prefs.set({ language: 'en' } as Prefs);
  backend.currentProfile.mockResolvedValue(null);
  backend.ensureAnonymous.mockResolvedValue(anonProfile);
  backend.registerAccount.mockResolvedValue(acctProfile);
  backend.signIn.mockResolvedValue(acctProfile);
  backend.signOut.mockResolvedValue(undefined);
  backend.updateDisplayName.mockResolvedValue(true);
  backend.deleteSelf.mockResolvedValue(true);
  __resetIdentityForTests();
});

afterEach(() => vi.clearAllMocks());

describe('initIdentity', () => {
  it('mints + persists a stable deviceId on first run', async () => {
    await initIdentity();
    expect(get(identity).deviceId).toBeTruthy();
    expect(store.identityRecord?.deviceId).toBe(get(identity).deviceId);
  });

  it('reuses an already-stored deviceId', async () => {
    store.identityRecord = { deviceId: 'existing-dev' };
    await initIdentity();
    expect(get(identity).deviceId).toBe('existing-dev');
  });
});

describe('offline / no-backend guard', () => {
  it('stays local and makes NO backend calls when unconfigured', async () => {
    configured.mockReturnValue(false);
    store.identityRecord = { deviceId: 'd' };
    await initIdentity();
    await ensureServerIdentity();
    expect(get(identity).sync).toBe('local');
    expect(get(identity).deviceId).toBe('d');
    expect(backend.ensureAnonymous).not.toHaveBeenCalled();
    expect(backend.currentProfile).not.toHaveBeenCalled();
  });
});

describe('ensureServerIdentity', () => {
  it('adopts an already-authed profile without re-creating anon', async () => {
    store.identityRecord = { deviceId: 'd' };
    backend.currentProfile.mockResolvedValue(acctProfile);
    await ensureServerIdentity();
    expect(backend.ensureAnonymous).not.toHaveBeenCalled();
    expect(get(identity).tier).toBe('account');
    expect(get(identity).email).toBe('me@example.com');
    expect(get(identity).sync).toBe('synced');
  });

  it('mints + persists an anon secret, then ensures the anon account', async () => {
    store.identityRecord = { deviceId: 'd' };
    await ensureServerIdentity();
    expect(store.identityRecord?.anonSecret).toBeTruthy();
    expect(backend.ensureAnonymous).toHaveBeenCalledWith('d', store.identityRecord!.anonSecret, '');
    expect(get(identity).tier).toBe('anonymous');
    expect(get(identity).sync).toBe('synced');
  });

  it('reports sync error when the anon ensure fails', async () => {
    store.identityRecord = { deviceId: 'd' };
    backend.ensureAnonymous.mockResolvedValue(null);
    await ensureServerIdentity();
    expect(get(identity).sync).toBe('error');
  });
});

describe('renameTo', () => {
  it('updates the local playerName pref immediately', async () => {
    store.identityRecord = { deviceId: 'd' };
    await initIdentity();
    await renameTo('  Cartographer  ');
    expect(get(store.prefs).playerName).toBe('Cartographer');
    expect(get(identity).displayName).toBe('Cartographer');
  });

  it('syncs the name to the server when signed in', async () => {
    backend.currentProfile.mockResolvedValue(acctProfile);
    await ensureServerIdentity(); // establishes currentId = rec-real
    await renameTo('Newname');
    expect(backend.updateDisplayName).toHaveBeenCalledWith('rec-real', 'Newname');
  });
});

describe('upgrade', () => {
  it('registers a real account and becomes tier=account', async () => {
    store.identityRecord = { deviceId: 'd' };
    await initIdentity();
    const res = await upgrade('me@example.com', 'password123');
    expect(res.ok).toBe(true);
    expect(backend.registerAccount).toHaveBeenCalled();
    expect(get(identity).tier).toBe('account');
    expect(get(identity).email).toBe('me@example.com');
  });

  it('returns no-backend when unconfigured (never throws)', async () => {
    configured.mockReturnValue(false);
    const res = await upgrade('me@example.com', 'password123');
    expect(res).toEqual({ ok: false, error: 'no-backend' });
    expect(backend.registerAccount).not.toHaveBeenCalled();
  });

  it('returns failed when registration fails', async () => {
    backend.registerAccount.mockResolvedValue(null);
    const res = await upgrade('taken@example.com', 'password123');
    expect(res).toEqual({ ok: false, error: 'failed' });
  });
});

describe('signIn (reclaim identity, keep local progress)', () => {
  it('adopts the account and reflects its name locally', async () => {
    store.identityRecord = { deviceId: 'd' };
    await initIdentity();
    store.prefs.update((p) => ({ ...p, playerName: 'OldLocalName' }));
    const res = await signIn('me@example.com', 'password123');
    expect(res.ok).toBe(true);
    expect(get(identity).tier).toBe('account');
    // The server display name follows the account onto this device (OQ7).
    expect(get(store.prefs).playerName).toBe('Nomad');
    // Local deviceId (the key local progress hangs off) is unchanged.
    expect(store.identityRecord?.deviceId).toBe('d');
  });
});

describe('signOut', () => {
  it('reverts to anonymous and re-ensures the anon identity', async () => {
    backend.currentProfile.mockResolvedValue(acctProfile);
    await ensureServerIdentity();
    expect(get(identity).tier).toBe('account');

    // After sign-out the next ensure should find no auth → anon.
    backend.currentProfile.mockResolvedValue(null);
    store.identityRecord = { deviceId: 'd', anonSecret: 's' };
    await signOut();
    expect(backend.signOut).toHaveBeenCalled();
    expect(get(identity).tier).toBe('anonymous');
    expect(get(identity).email).toBeNull();
  });
});

describe('deleteAccount', () => {
  it('deletes the server record and reverts to anonymous', async () => {
    backend.currentProfile.mockResolvedValue(acctProfile);
    await ensureServerIdentity(); // currentId = rec-real
    backend.currentProfile.mockResolvedValue(null);
    store.identityRecord = { deviceId: 'd', anonSecret: 's' };
    const res = await deleteAccount();
    expect(res.ok).toBe(true);
    expect(backend.deleteSelf).toHaveBeenCalledWith('rec-real');
    expect(get(identity).tier).toBe('anonymous');
  });

  it('returns no-backend when unconfigured', async () => {
    configured.mockReturnValue(false);
    const res = await deleteAccount();
    expect(res).toEqual({ ok: false, error: 'no-backend' });
  });
});
