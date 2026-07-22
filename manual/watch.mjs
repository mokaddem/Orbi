// Watch mode for the manual labs: (re)launch a lab and restart it whenever you save the component
// you're tuning or the spec itself — so the loop is just edit → save → the lab reopens with the new
// code. Dependency-free (Node's built-in fs.watch + child_process + fetch). Any args after
// `node watch.mjs` are forwarded straight to `playwright test`, e.g.  node watch.mjs --project=levelup
//
// It keeps ONE dev server up (from this checkout, so /manual/harness-*.ts is always served) and
// reuses it across restarts, so re-runs are fast. Point at your own server with MANUAL_BASE_URL
// (then none is started); change the auto-start port with MANUAL_PORT. Ctrl-C stops everything.
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const manualDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(manualDir, '..');
const passthrough = process.argv.slice(2);

const PORT = process.env.MANUAL_PORT || '5183';
const BASE = process.env.MANUAL_BASE_URL || `http://localhost:${PORT}`;

// Directories to watch, and (for the shared component dir) which filenames actually matter — so an
// unrelated component edit doesn't bounce your lab. Everything under manual/tests always counts.
const WATCH_DIRS = [resolve(repoRoot, 'src/ui/components'), resolve(manualDir, 'tests')];
const RELEVANT = new Set([
  'SessionXpCard.svelte', // level-up animation
  'WorldMap.svelte', // map + magnet caps
  'map-hit.ts', // magnet math
  'projection.ts',
  'map-framing.ts',
]);

let server = null; // dev server WE started (null if reusing an existing one or using MANUAL_BASE_URL)
let child = null; // current playwright run
let restartQueued = false;
let debounce = null;

// Spawn a process as its own group leader so we can tear down IT AND its children (npx → vite,
// playwright → browser) in one shot — killing just the npx wrapper would orphan the real process.
function spawnGroup(cmd, args, opts) {
  return spawn(cmd, args, { ...opts, detached: true });
}
function killGroup(proc, signal = 'SIGTERM') {
  if (!proc || proc.killed) return;
  try {
    process.kill(-proc.pid, signal); // negative pid = the whole process group
  } catch {
    try {
      proc.kill(signal);
    } catch {
      /* already gone */
    }
  }
}

async function ping(url) {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (process.env.MANUAL_BASE_URL) {
    console.log(`\x1b[2m↺ using MANUAL_BASE_URL=${BASE}\x1b[0m`);
    return;
  }
  if (await ping(BASE)) {
    console.log(`\x1b[2m↺ reusing dev server already at ${BASE}\x1b[0m`);
    return;
  }
  console.log(`\x1b[2m⏻ starting dev server at ${BASE} (vite, from ${repoRoot}) …\x1b[0m`);
  server = spawnGroup('npx', ['vite', '--port', PORT, '--strictPort'], {
    cwd: repoRoot,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const end = Date.now() + 60_000;
  while (Date.now() < end) {
    if (await ping(BASE)) return;
    await sleep(300);
  }
  console.error('dev server did not come up in time');
  shutdown(1);
}

function launch() {
  console.log(`\n\x1b[36m▶ playwright test ${passthrough.join(' ')}\x1b[0m`);
  child = spawnGroup('npx', ['playwright', 'test', ...passthrough], {
    stdio: 'inherit',
    cwd: manualDir,
    env: { ...process.env, MANUAL_BASE_URL: BASE }, // reuse our server; skip config's webServer
  });
  child.on('exit', () => {
    child = null;
    if (restartQueued) {
      restartQueued = false;
      launch();
    }
  });
}

function restart() {
  if (child) {
    restartQueued = true;
    killGroup(child); // closes the current lab window; relaunch fires on its exit
  } else {
    launch();
  }
}

function onChange(filename) {
  if (!filename) return;
  const name = basename(filename);
  if (name.startsWith('.') || name.endsWith('~') || name.endsWith('.swp') || name.endsWith('.tmp')) return;
  // Accept spec/helper edits (under tests) or one of the relevant components.
  const isTest = filename.includes('tests') && (name.endsWith('.ts') || name.endsWith('.js'));
  if (!isTest && !RELEVANT.has(name)) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    console.log(`\n\x1b[33m↻ ${name} changed — restarting the lab…\x1b[0m`);
    restart();
  }, 200);
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  killGroup(child);
  killGroup(server);
  setTimeout(() => process.exit(code), 300); // give SIGTERM a beat to land
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

await ensureServer();

for (const dir of WATCH_DIRS) {
  try {
    watch(dir, { recursive: true }, (_evt, filename) => onChange(filename));
  } catch (err) {
    console.warn(`(could not watch ${dir}: ${err.message})`);
  }
}

console.log('\x1b[2mWatching src/ui/components + manual/tests — save to restart, Ctrl-C to quit.\x1b[0m');
launch();
