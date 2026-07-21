import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Foundation client seam so identity ops run against a fake PocketBase — no
// network, no live server. `getClient` returns our stub (or null to simulate no backend).
const pb = vi.hoisted(() => {
  const create = vi.fn();
  const authWithPassword = vi.fn();
  const update = vi.fn();
  const del = vi.fn();
  const clear = vi.fn();
  return {
    create,
    authWithPassword,
    update,
    del,
    clear,
    authStore: { isValid: false, record: null as unknown, clear },
    collection: () => ({ create, authWithPassword, update, delete: del }),
  };
});

const getClient = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ getClient }));

import {
  anonEmail,
  ensureAnonymous,
  signIn,
  registerAccount,
  updateDisplayName,
  deleteSelf,
  currentProfile,
  signOut,
} from './identity';

const rec = (over = {}) => ({
  id: 'r1',
  displayName: 'Ada',
  deviceId: 'dev-1',
  isAnonymous: true,
  email: 'dev-1@anon.invalid',
  ...over,
});

beforeEach(() => {
  getClient.mockResolvedValue(pb);
  pb.create.mockReset();
  pb.authWithPassword.mockReset();
  pb.update.mockReset();
  pb.del.mockReset();
  pb.clear.mockReset();
  pb.authStore.isValid = false;
  pb.authStore.record = null;
});

afterEach(() => vi.clearAllMocks());

describe('anonEmail', () => {
  it('derives a non-deliverable address from the device id', () => {
    expect(anonEmail('abc')).toBe('abc@anon.invalid');
  });
});

describe('with no backend (getClient null)', () => {
  beforeEach(() => getClient.mockResolvedValue(null));

  it('all ops resolve to null/false without throwing', async () => {
    expect(await ensureAnonymous('d', 's', 'n')).toBeNull();
    expect(await signIn('e', 'p')).toBeNull();
    expect(await registerAccount('e', 'p', 'n', 'd')).toBeNull();
    expect(await updateDisplayName('id', 'n')).toBe(false);
    expect(await deleteSelf('id')).toBe(false);
    expect(await currentProfile()).toBeNull();
    await expect(signOut()).resolves.toBeUndefined();
  });
});

describe('ensureAnonymous', () => {
  it('creates the anon account then signs in (mapping the record)', async () => {
    pb.authWithPassword.mockResolvedValue({ record: rec() });
    const profile = await ensureAnonymous('dev-1', 'secret', 'Ada');
    expect(pb.create).toHaveBeenCalled();
    expect(pb.authWithPassword).toHaveBeenCalledWith('dev-1@anon.invalid', 'secret');
    expect(profile).toMatchObject({ id: 'r1', deviceId: 'dev-1', isAnonymous: true });
    // The synthetic anon email is hidden from the app's view.
    expect(profile?.email).toBe('');
  });

  it('still signs in when the account already exists (create throws)', async () => {
    pb.create.mockRejectedValue(new Error('already exists'));
    pb.authWithPassword.mockResolvedValue({ record: rec() });
    const profile = await ensureAnonymous('dev-1', 'secret', 'Ada');
    expect(profile).not.toBeNull();
  });
});

describe('registerAccount (upgrade path)', () => {
  it('creates a real account and signs in, exposing the real email', async () => {
    pb.authWithPassword.mockResolvedValue({
      record: rec({ isAnonymous: false, email: 'me@example.com' }),
    });
    const profile = await registerAccount('me@example.com', 'password123', 'Ada', 'dev-1');
    expect(pb.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'me@example.com', isAnonymous: false }),
    );
    expect(profile).toMatchObject({ isAnonymous: false, email: 'me@example.com' });
  });

  it('returns null when the email is taken (create throws)', async () => {
    pb.create.mockRejectedValue(new Error('taken'));
    expect(await registerAccount('taken@example.com', 'password123', 'Ada', 'dev-1')).toBeNull();
    expect(pb.authWithPassword).not.toHaveBeenCalled();
  });
});

describe('updateDisplayName / deleteSelf / currentProfile', () => {
  it('updateDisplayName returns true on success, false on failure', async () => {
    pb.update.mockResolvedValue({});
    expect(await updateDisplayName('r1', 'New')).toBe(true);
    pb.update.mockRejectedValue(new Error('nope'));
    expect(await updateDisplayName('r1', 'New')).toBe(false);
  });

  it('deleteSelf deletes then clears the auth token', async () => {
    pb.del.mockResolvedValue(true);
    expect(await deleteSelf('r1')).toBe(true);
    expect(pb.clear).toHaveBeenCalled();
  });

  it('currentProfile maps a valid cached auth record, else null', async () => {
    expect(await currentProfile()).toBeNull(); // not valid
    pb.authStore.isValid = true;
    pb.authStore.record = rec({ isAnonymous: false, email: 'me@example.com' });
    expect(await currentProfile()).toMatchObject({ id: 'r1', email: 'me@example.com' });
  });
});
