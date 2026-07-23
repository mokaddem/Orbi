# Manual interaction labs

Hands-on Playwright **labs for tuning two interactions by feel** — the post-session **level-up
animation** and the map's **magnet-pull** country selection on touch.

> These are **not** part of the app or `npm test`/CI. They live here on their own, with their own
> `package.json`, and are meant to be run by hand while you fiddle with the code.

They work by loading the running dev server and, inside the page, dynamically importing the app's
**real** components (`SessionXpCard`, `WorldMap`) and mounting them with controlled props — so you're
tuning the actual thing, not a mock. The `harness-*.ts` files are tiny re-export bridges that let the
page import the Svelte runtime + a component in one go (nothing in the app imports them).

## Setup (once)

```bash
cd manual
npm install
npm run setup        # downloads the Chromium browser Playwright drives
```

## The dev server (started for you)

The labs load the app's real components from `/manual/harness-*.ts`, which only **this** checkout
serves. So a lab **auto-starts its own Vite dev server from this checkout** (on port **5183**) and
tears it down when it's done — you don't need to start one, and it won't collide with your normal
`:5180` server. (Watch mode keeps that server up between restarts so re-runs are fast.)

- **Don't** rely on your `:5180` server — if it's rooted in your *main* checkout it has no `manual/`
  folder, and the lab's import will fail with `Failed to fetch dynamically imported module`.
- Want to use your own server anyway? Set `MANUAL_BASE_URL` (then nothing is auto-started), e.g.
  `MANUAL_BASE_URL=http://localhost:5180 npm run levelup` — but that server must be running from a
  checkout that contains this `manual/` folder.
- Change the auto-start port with `MANUAL_PORT=5190`.
- Running from a *fresh* worktree/clone? It needs the app's `node_modules` for Vite (run `npm install`
  at the repo root, or symlink your main checkout's).

## The labs

### 1. Level-up animation

```bash
npm run levelup
LEVELUP_RANK=9 npm run levelup     # open straight on a given target rank (1..14)
```

Mounts the real `SessionXpCard` mid-roll-over. A control bar lets you **Replay**, step through every
rank **tier** (the medal motion differs per band — bronze / silver / gold / platinum / crystal), and
toggle **reduce-motion** to compare. Edit the timings in
`src/ui/components/SessionXpCard.svelte` — `REVEAL_HOLD_MS`, `STEP_MS`, `TWEEN_MS`, the `.track.rolled`
transition, the confetti / badge-pop — save (Vite HMR reloads), and hit **Replay**. The window stays
open until you close it.

### 2. Map magnet-pull (touch)

Runs under **Pixel-5 emulation** so the map uses the wider **touch** snap radii.

```bash
npm run magnet:feel                        # tap around by hand, live HUD
MAGNET_TARGET=LI npm run magnet:feel       # start on a given micro-state
npm run magnet:sweep                       # measure the effective magnet radius per country
MAGNET_ONLY=VA,MC,LI npm run magnet:sweep  # only these
MAGNET_FOCUS=IT,FR,CH,AT,SI npm run magnet:sweep   # frame a region instead of the world
```

- **feel** — opens the interactive map with a micro-state as the asked country and a HUD showing
  `target · last pick · tap-offset (logical units)`. Buttons switch the target. Tap near/around the
  speck and watch where the pull grabs it vs. lets a neighbour steal it. Window stays open until you
  close it.
- **sweep** — fires synthetic taps at growing offsets (8 directions) from each micro-state's aim-dot
  and prints the **effective accept radius in logical units** (the fixed 980×500 surface). Compare it
  against the caps you're tuning in `src/ui/components/WorldMap.svelte`:

  | cap | fine (mouse) | coarse (touch) | what it does |
  |-----|-----|-----|-----|
  | `SNAP_CAP` | 44 | **58** | ocean/gap tap snaps to the nearest country within this |
  | `DOT_SNAP_CAP` | 18 | **26** | micro-state aim-dot magnet radius |
  | `TARGET_ACCEPT_CAP` | 36 | **50** | a tap this close to the *asked* micro-state's dot counts as it |

  A low radius in one direction means a big neighbour's body steals the tap before the accept radius —
  the table lists which country stole it and at what distance. World framing is the hardest case
  (specks tiny, dots crowded); a `MAGNET_FOCUS` region spreads them out like an in-region game does.

## Watch mode (live tuning loop)

Each lab has a `:watch` variant that **re-launches it automatically whenever you save** the component
you're tuning (or the spec). So the loop is just: edit → save → the lab reopens with the new code.

```bash
npm run levelup:watch
npm run magnet:feel:watch
npm run magnet:sweep:watch     # re-prints the radius table on every save — handy for tuning the caps
```

It watches `src/ui/components` (`SessionXpCard` / `WorldMap` / `map-hit` / `projection` / `map-framing`)
and `manual/tests`. Env vars work the same (e.g. `LEVELUP_RANK=9 npm run levelup:watch`). Ctrl-C quits.

## Notes

- Headed by default (that's the point). Close the window to end a `feel`/`levelup` lab; `sweep` ends
  on its own and prints its table.
- If a lab can't import `/manual/harness-*.ts`, the dev server isn't serving this folder — make sure
  the dev server you point at is running from a checkout that **contains** this `manual/` directory.
