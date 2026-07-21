import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the PocketBase SDK so the seam is exercised with NO network and no live
// server (the offline-first contract). `vi.hoisted` lets the mock factory — which
// is hoisted above imports — reference these spies.
const { healthCheck, getFirstListItem } = vi.hoisted(() => ({
  healthCheck: vi.fn(),
  getFirstListItem: vi.fn(),
}));

vi.mock('pocketbase', () => ({
  default: class {
    url: string;
    health = { check: healthCheck };
    constructor(url: string) {
      this.url = url;
    }
    collection() {
      return { getFirstListItem };
    }
  },
}));

import {
  resolveBackendUrl,
  backendUrl,
  isBackendConfigured,
  getClient,
  checkHealth,
  readPing,
  __resetClientForTests,
} from './client';

beforeEach(() => {
  __resetClientForTests();
  healthCheck.mockReset();
  getFirstListItem.mockReset();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  __resetClientForTests();
});

describe('resolveBackendUrl (pure logic)', () => {
  it('uses the configured URL when present, in dev or prod', () => {
    expect(resolveBackendUrl('https://api.example.com', false)).toBe('https://api.example.com');
    expect(resolveBackendUrl('https://api.example.com', true)).toBe('https://api.example.com');
  });

  it('trims, and treats blank/undefined as unset', () => {
    expect(resolveBackendUrl('   ', false)).toBeNull();
    expect(resolveBackendUrl(undefined, false)).toBeNull();
  });

  it('falls back to localhost in dev when unset', () => {
    expect(resolveBackendUrl(undefined, true)).toBe('http://localhost:8090');
    expect(resolveBackendUrl('', true)).toBe('http://localhost:8090');
  });

  it('is disabled (null) in a production build when unset — the offline-optional default', () => {
    expect(resolveBackendUrl(undefined, false)).toBeNull();
  });
});

describe('backendUrl / isBackendConfigured (reads VITE_PB_URL)', () => {
  it('reflects a configured VITE_PB_URL', () => {
    vi.stubEnv('VITE_PB_URL', 'https://api.example.com');
    expect(backendUrl()).toBe('https://api.example.com');
    expect(isBackendConfigured()).toBe(true);
  });
});

describe('client seam with a configured backend (SDK mocked — no network)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PB_URL', 'https://api.example.com');
  });

  it('lazily constructs a single cached client', async () => {
    const a = await getClient();
    const b = await getClient();
    expect(a).not.toBeNull();
    expect(a).toBe(b); // cached — SDK imported + client constructed at most once
  });

  it('checkHealth resolves true when the health endpoint is OK', async () => {
    healthCheck.mockResolvedValue({ code: 200 });
    await expect(checkHealth()).resolves.toBe(true);
  });

  it('checkHealth resolves false (never throws) when the backend is down', async () => {
    healthCheck.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(checkHealth()).resolves.toBe(false);
  });

  it('readPing returns the seeded message on a real round-trip', async () => {
    getFirstListItem.mockResolvedValue({ message: 'pong' });
    await expect(readPing()).resolves.toBe('pong');
  });

  it('readPing resolves null (never throws) on failure', async () => {
    getFirstListItem.mockRejectedValue(new Error('offline'));
    await expect(readPing()).resolves.toBeNull();
  });
});
