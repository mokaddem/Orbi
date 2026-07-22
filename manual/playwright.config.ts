import { defineConfig, devices } from '@playwright/test';

// These are manual, watch-and-tune labs — headed by default, one at a time, no timeout.
// Point them at any running dev server via MANUAL_BASE_URL (defaults to the pinned 5180).
const baseURL = process.env.MANUAL_BASE_URL || 'http://localhost:5180';

export default defineConfig({
  testDir: './tests',
  timeout: 0, // a lab runs until you close its window (the sweep still ends on its own)
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    // Headed by default (these are watch-and-tune labs). Set MANUAL_HEADLESS=1 to run headless
    // (e.g. on a machine with no display, or for a quick self-check of the sweep).
    headless: process.env.MANUAL_HEADLESS === '1',
    locale: 'en-US',
    reducedMotion: 'no-preference',
    navigationTimeout: 30_000,
    actionTimeout: 20_000,
  },
  projects: [
    {
      // The level-up card lab — a roomy portrait so the whole Summary card is on screen.
      name: 'levelup',
      testMatch: /levelup\.spec\.ts/,
      use: { viewport: { width: 440, height: 920 } },
    },
    {
      // The magnet lab — Pixel 5 emulation gives a *coarse pointer*, so the map uses the
      // wider TOUCH snap radii (SNAP_CAP 58 / DOT_SNAP_CAP 26 / TARGET_ACCEPT_CAP 50).
      name: 'magnet',
      testMatch: /magnet\.spec\.ts/,
      use: { ...devices['Pixel 5'], headless: false },
    },
  ],
});
