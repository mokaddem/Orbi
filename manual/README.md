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

## Prerequisite: a dev server

The labs point at **http://localhost:5180** by default. Start the app's dev server from the repo root
in another terminal and leave it running:

```bash
npm run dev          # repo root — Vite on 5180
```

Point at a different server with `MANUAL_BASE_URL`, e.g. `MANUAL_BASE_URL=http://localhost:5181`.

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

## Notes

- Headed by default (that's the point). Close the window to end a `feel`/`levelup` lab; `sweep` ends
  on its own and prints its table.
- If a lab can't import `/manual/harness-*.ts`, the dev server isn't serving this folder — make sure
  the dev server you point at is running from a checkout that **contains** this `manual/` directory.
