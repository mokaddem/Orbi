// Watch mode for the manual labs: (re)launch a lab and restart it whenever you save the component
// you're tuning or the spec itself — so the loop is just edit → save → the lab reopens with the new
// code. Dependency-free (Node's built-in fs.watch + child_process). Any args after `node watch.mjs`
// are forwarded straight to `playwright test`, e.g.  node watch.mjs --project=levelup
//
// Ctrl-C stops watching and closes the lab.
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const manualDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(manualDir, '..');
const passthrough = process.argv.slice(2);

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

let child = null;
let restartQueued = false;
let debounce = null;

function launch() {
  console.log(`\n\x1b[36m▶ playwright test ${passthrough.join(' ')}\x1b[0m`);
  child = spawn('npx', ['playwright', 'test', ...passthrough], { stdio: 'inherit', cwd: manualDir });
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
    child.kill('SIGTERM'); // closes the current lab window; relaunch fires on its exit
  } else {
    launch();
  }
}

function onChange(filename) {
  if (!filename) return;
  const name = basename(filename);
  if (name.startsWith('.') || name.endsWith('~') || name.endsWith('.swp') || name.endsWith('.tmp')) return;
  // Accept spec/helper edits (under tests) or one of the relevant components.
  const isTest = filename.includes(`tests`) && (name.endsWith('.ts') || name.endsWith('.js'));
  if (!isTest && !RELEVANT.has(name)) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    console.log(`\n\x1b[33m↻ ${name} changed — restarting the lab…\x1b[0m`);
    restart();
  }, 200);
}

for (const dir of WATCH_DIRS) {
  try {
    watch(dir, { recursive: true }, (_evt, filename) => onChange(filename));
  } catch (err) {
    console.warn(`(could not watch ${dir}: ${err.message})`);
  }
}

process.on('SIGINT', () => {
  if (child) child.kill('SIGTERM');
  process.exit(0);
});

console.log('\x1b[2mWatching src/ui/components + manual/tests — save to restart, Ctrl-C to quit.\x1b[0m');
launch();
