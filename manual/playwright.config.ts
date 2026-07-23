import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// These are manual, watch-and-tune labs — headed by default, one at a time, no timeout.
//
// The labs import the app's real components from `/manual/harness-*.ts`, which only *this* checkout
// serves. So by default we AUTO-START a dev server from this checkout (below) — that way the labs
// don't depend on what happens to be running on :5180 (your main checkout's server won't have the
// `manual/` folder). Point at your own server instead with MANUAL_BASE_URL (then no server is
// started for you), or change the auto-start port with MANUAL_PORT.
const explicitBase = process.env.MANUAL_BASE_URL;
const port = process.env.MANUAL_PORT || '5183';
const baseURL = explicitBase || `http://localhost:${port}`;
// The repo/worktree root (parent of manual/) — where index.html + the manual/ folder live.
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  testDir: './tests',
  timeout: 0, // a lab runs until you close its window (the sweep still ends on its own)
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  // Auto-start a dev server from THIS checkout unless you supplied your own via MANUAL_BASE_URL.
  ...(explicitBase
    ? {}
    : {
        webServer: {
          command: `npx vite --port ${port} --strictPort`,
          cwd: repoRoot,
          url: baseURL,
          reuseExistingServer: true, // reuse one already on this port (e.g. watch mode's)
          timeout: 120_000,
          stdout: 'ignore',
          stderr: 'pipe',
        },
      }),
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
      use: { ...devices['Pixel 5'] },
    },
  ],
});
