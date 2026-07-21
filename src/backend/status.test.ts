import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock the client seam so the connectivity store is tested with NO network and no
// live server. CI never needs a running PocketBase — the real pipe is covered by a
// documented manual smoke (see server/README.md).
vi.mock('./client', () => ({
  isBackendConfigured: vi.fn(() => true),
  checkHealth: vi.fn(async () => true),
}));

import * as client from './client';
import { backendStatus, probeBackend, __resetStatusForTests } from './status';

const isConfigured = vi.mocked(client.isBackendConfigured);
const checkHealth = vi.mocked(client.checkHealth);

beforeEach(() => {
  isConfigured.mockReturnValue(true);
  checkHealth.mockResolvedValue(true);
  __resetStatusForTests();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('backend connectivity store', () => {
  it('starts "unknown" when a backend is configured', () => {
    expect(get(backendStatus)).toBe('unknown');
  });

  it('becomes "reachable" when the health probe succeeds', async () => {
    checkHealth.mockResolvedValue(true);
    await expect(probeBackend()).resolves.toBe('reachable');
    expect(get(backendStatus)).toBe('reachable');
  });

  it('becomes "unreachable" when the health probe fails', async () => {
    checkHealth.mockResolvedValue(false);
    await expect(probeBackend()).resolves.toBe('unreachable');
    expect(get(backendStatus)).toBe('unreachable');
  });

  it('is "disabled-no-url" and makes NO probe when unconfigured', async () => {
    isConfigured.mockReturnValue(false);
    __resetStatusForTests();
    expect(get(backendStatus)).toBe('disabled-no-url');
    await expect(probeBackend()).resolves.toBe('disabled-no-url');
    expect(checkHealth).not.toHaveBeenCalled();
  });

  it('never throws even if the probe rejects', async () => {
    checkHealth.mockRejectedValue(new Error('boom'));
    await expect(probeBackend()).resolves.toBe('unreachable');
    expect(get(backendStatus)).toBe('unreachable');
  });

  it('dedupes concurrent probes into a single health call', async () => {
    let resolve!: (v: boolean) => void;
    checkHealth.mockReturnValue(new Promise<boolean>((r) => (resolve = r)));
    const a = probeBackend();
    const b = probeBackend();
    resolve(true);
    await Promise.all([a, b]);
    expect(checkHealth).toHaveBeenCalledTimes(1);
    expect(get(backendStatus)).toBe('reachable');
  });
});
