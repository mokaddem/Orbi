# Phase 38 — Play on a 3D globe (WebGL projection)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** 🟡 In progress (Stages 1 + 2 built
& verified; pending owner review + on-device check + merge) · **Progress:** ~95% · **Track:** v2.2 —
Dimensional maps

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Let the player choose a **real, interactive 3D globe** as the map surface, with the **same
functionality as the flat map** — both `map-highlight` and `map-locate` fully playable — but
smooth to spin, zoom, and fly between regions, and visibly **playful**. This is the orthographic
"globe" that Phase 28 deliberately deferred, now built as a proper WebGL planet rather than a static
projection.

## The trigger (owner report)
> "Let's check a new map projection: Globe. Integrate this new projection to have a 3d globe on which
> to play with the same functionalities as the map." … followed by (after rejecting a flat SVG
> orthographic spike): *"Spanning the globe should be smooth, same for zooming and while going to
> regions. Make the globe playful. You can use canvas, or a 3d engine like three.js."*

## Owner decisions so far (clarifying round #1, 2026-07-12)
- **Interaction model:** a **fully rotatable** globe (drag to spin), *not* a static hemisphere.
- **Placement:** a **5th entry in the existing map-projection dropdown** (`'globe'`), one global choice
  driving both map modes — consistent with Phase 28.
- **Technology:** **three.js (WebGL)**. New dependencies are explicitly allowed; smoothness and
  playfulness take priority over bundle minimalism for this surface.
- **Prototype:** two throwaway spikes were built and reviewed (`globe-proto-3d.html` three.js,
  `globe-proto-canvas.html` canvas+versor). The owner chose **A · three.js**. The spike proved out the
  core techniques below (see Technical notes) and is the reference for the production component.

## In scope
- A new **`'globe'`** value for the `mapProjection` preference (Phase 28's enum), persisted & validated
  like the others.
- A new **`GlobeMap.svelte`** WebGL renderer that `MapBoard` selects when `projection === 'globe'`,
  implementing the **same prop contract** as `WorldMap.svelte` so `Play` and the Settings preview drive
  it identically.
- **Both map modes on the globe:** `map-highlight` (prompt country ringed/pinned, globe auto-rotates it
  to the front) and `map-locate` (click a country; drag to find; wrong-answer reveal).
- **Smooth interaction:** damped inertial drag-spin, dolly zoom, and eased **fly-to-region** on the
  active region filter and per-question re-framing.
- **Settings integration:** `'globe'` in the dropdown + the live preview showing the globe.
- **i18n** (EN/FR/DE) for the new projection name, and a **graceful fallback** when WebGL is
  unavailable.

## Current state (so scope is clear)
- **Projection is a persisted enum.** `MapProjection = 'naturalEarth' | 'equalEarth' | 'equirectangular'
  | 'mercator'` with `MAP_PROJECTIONS`, `isMapProjection`, and `clampPrefs` coercion in
  `src/data/persistence/types.ts`; default `naturalEarth`. Adding `'globe'` follows that exact pattern.
- **`projectionFor(name)`** (`src/ui/components/projection.ts`) maps the enum → a **planar** D3
  projection. It is the wrong home for the globe (no rotation/clip model); the globe is handled by
  **renderer selection**, not by `projectionFor`. (`projectionFor` must stay total over the enum — see
  Technical notes for how `'globe'` is handled there without being used.)
- **`WorldMap.svelte`** is the flat renderer: it projects every country **once** via `fitExtent`
  (memoized on `features`/`focusIsos`/`projection`), draws one SVG `<path>` per country, and layers
  markers, reveal/picked labels + leader lines, micro-state aim dots (`area < SMALL_AREA`), and Phase-37
  `d3-zoom` pan/zoom + nearest-country ocean-snap (`map-hit.ts`).
- **`MapBoard.svelte`** is the async wrapper: it `loadCountryFeatures()` (memoized TopoJSON decode) and
  renders `WorldMap` with the full prop set. `Play` **lazy-imports `MapBoard`** so d3-geo/geometry stay
  out of the flag-only bundle. **This is the natural seam for lazy-loading three.js too.**
- **`Play.svelte`** passes the live props: `highlightIso`, `interactive`, `disabled`, `pickedIso/Label`,
  `revealIso/Label`, `focusIsos={mapFocusIsos(cfg)}`, `projection={$prefs.mapProjection}`,
  `reduceMotion={$prefs.reduceMotion}`, `questionKey={s.index}`, `onpick`.
- **`Settings.svelte`** renders the "Map" section: a dropdown over `MAP_PROJECTIONS` (localized via
  `settings.projection.*`) + a lazy-loaded live-preview `MapBoard projection={$prefs.mapProjection}`.
- **`AtlasMap.svelte`** is a *separate*, display-only flat map (its own `projectWorld`), unaffected by the
  `mapProjection` pref. Whether the globe reaches the Atlas is an Open Question (recommended: no).
- **`reduceMotion`** pref already exists (Phase 33/37) and gates map animation.

## Depends on
Phase 4 (map modes), Phase 12 (`map-framing.ts`), Phase 22 (micro-state visibility / target-first
reveal), Phase 28 (`mapProjection` pref + Settings control + live preview), Phase 37 (zoom model &
`reduceMotion` plumbing). Independent of non-map work.

## Scope / Deliverables

### Stage 1 — The globe renders and both modes are playable ✅
- [x] **`'globe'` pref** — extended `MapProjection`, `MAP_PROJECTIONS`, `isMapProjection`, `clampPrefs`;
      migration-safe (absent/corrupt → `naturalEarth`). (`persistence/types.ts` + tests.)
- [x] **`GlobeMap.svelte`** — a three.js renderer with the **same props** as `WorldMap`. A textured
      sphere (equirectangular country texture drawn from `loadCountryFeatures`), atmosphere glow, and
      `OrbitControls` (damped drag-spin + dolly zoom). Lazy-loads three.js. Pure geo/math extracted to
      `globe-geo.ts` (unit-tested); the Svelte shell stays thin (WebGL can't run in jsdom).
- [x] **`MapBoard` renderer switch** — renders `GlobeMap` when `projection === 'globe'`, else `WorldMap`;
      identical prop pass-through. three.js is **lazy-imported** on the globe path only, so flat-map/flag
      sessions never download it. WebGL-absent → flat Natural Earth fallback.
- [x] **`map-highlight`** — highlight country filled turquoise + drop-pin; **auto-rotates the target to
      the front** on each question (globe analogue of the flat auto-zoom).
- [x] **`map-locate` picking** — raycast the sphere → lat/lon → **`geoContains`** resolves the exact
      country; reports ISO via `onpick`; back-hemisphere unclickable by construction. (A center-click
      headless test resolved to `GH`.)
- [x] **Settings** — `'globe'` in the dropdown (EN/FR/DE), the live preview renders the globe. Basic
      reveal/picked colouring already lands (green reveal, red wrong pick) as a Stage-1 freebie.

### Stage 2 — Feature parity & polish (match the flat map) ✅
- [x] **Locate reveal parity** — on answer the globe auto-rotates to the target, shows the **reveal
      label** (green pill) and, on a wrong pick, the **picked label** (red pill) as billboarded sprites
      floating above/below, plus green/red country fills + the pin on the target — target-first (Phase 22).
- [x] **Region framing** — fly-to the active region (`focusIsos`) at its `geoCentroid`, with a **fit
      distance derived from the region's angular radius** (`regionAngularRadius` + `fitDistanceForAngularRadius`
      in `globe-geo.ts`, unit-tested): compact regions zoom in, sprawling ones back off.
- [x] **Micro-state selectability** — a three-tier pick: (1) micro-state **aim-assist** within a tight
      16 px cap (countries with `geoArea < 3e-5` sr), (2) exact `geoContains`, (3) **ocean-gap snap** to
      the nearest visible country within 42 px — reusing the flat map's pure `nearestCountryWithinCap`.
- [x] **Zoom controls** — the +/−/reset cluster (shared Phase-37 i18n strings) driving a dolly zoom;
      scroll/pinch via OrbitControls; on the globe you **navigate by rotating, not panning**.
- [x] **Reduce-motion** — `reduceMotion` (or `prefers-reduced-motion`) disables idle spin, OrbitControls
      damping inertia, and fly-to tweens (instant camera), mirroring the flat map's instant path.
- [x] **WebGL fallback** — no WebGL → `MapBoard` renders the flat Natural Earth map (Stage 1).
- [x] **Settings** — `'globe'` in the dropdown; the live preview renders the globe with a **gentle idle
      spin** (passive view only, never mid-question, off under reduced motion). (Stage 1 + Stage 2.)
- [x] **i18n** — `settings.projection.globe` in EN/FR/DE; control labels reuse Phase-37 zoom strings.
- [x] **Tests** — pure helpers unit-tested (`globe-geo.test.ts`: lon/lat↔vec3 round-trip, texture px,
      antimeridian, region angular-radius + fit-distance); `GlobeMap` itself verified via headless
      Chrome (WebGL can't render in jsdom). Suite: **545 green**.
- [x] **Offline** — the three.js `GlobeMap` chunk (563 kB / 142 kB gz) is a separate lazy chunk and is
      in the PWA precache manifest (`dist/sw.js`), so the globe works offline.

## Technical notes (grounded in the prototype)
- **Renderer selection, not `projectionFor`.** `'globe'` is a *mode*, not a planar projection.
  `MapBoard` branches on it. Keep `projectionFor` total over the enum by mapping `'globe'` to a harmless
  planar fallback (e.g. `geoNaturalEarth1`) that is **never actually used** on the globe path, with a
  comment — or narrow `projectionFor`'s parameter to the planar subset. Decide during build.
- **Texture-on-sphere (from the spike).** Draw all countries once into an offscreen equirectangular
  canvas (`u=(lon+180)/360`, `v=(90-lat)/180`) → `THREE.CanvasTexture` on a `SphereGeometry`. Re-draw the
  texture only when highlight/pick/reveal changes (not per frame). Antimeridian-crossing polygons
  (Russia, Fiji, US) need the ±360 shift-and-redraw trick — the spike does a crude version; production
  needs it clean.
- **Coordinate conventions must match `SphereGeometry` UVs** so picking and texture align (the spike's
  `llToVec3`/`vec3ToLL` are correct against default `SphereGeometry`): `A=(lon+180)°`, `P=(90−lat)°`,
  `x=−cosA·sinP, y=cosP, z=sinA·sinP`. Keep the earth mesh unrotated so world = local for raycasts.
- **Picking = raycast → lat/lon → `geoContains`.** Exact, reuses bundled d3-geo, no per-country meshes to
  triangulate. This supersedes `map-hit.ts`'s nearest-centroid snap for direct hits; a micro-state
  *aid* may still adapt a nearest-**visible**-centroid snap (angular distance < cap, front hemisphere).
- **Smoothness.** `OrbitControls` gives damped inertial rotate + dolly zoom for free. Fly-to-region /
  auto-rotate-to-target = tween the camera position by `Vector3.slerp` between direction vectors +
  eased distance (a gentle `easeBack` overshoot reads as "playful"). Drop-pin = a billboarded `Sprite`
  with a bob.
- **Playful layer.** Atmosphere fresnel glow (additive back-side sphere), soft terminator shading via
  `MeshPhongMaterial` + `emissiveMap`, the coral drop-pin, springy fly-to. Room to grow (mascot-in-orbit,
  particles) but keep Stage-2 scope bounded.
- **Lazy-load & bundle.** three.js (~150 KB gzip) + `OrbitControls` load **only** via the `GlobeMap`
  path (dynamic import behind `MapBoard`), so flag/flat-map players never download it. Add the chunk to
  the workbox precache for offline. Note the cost honestly in the phase log.
- **Testing.** jsdom has no WebGL, so `GlobeMap` can't mount in Vitest. Keep all math/geometry in **pure,
  exported helpers** (unit-tested) and the Svelte component a thin shell; verify the live component with
  the headless-Chrome workflow (real WebGL via `--use-angle=swiftshader --enable-unsafe-swiftshader`, as
  the prototype was shot). Existing `WorldMap`/`map-framing`/`projection` tests must stay green.

## Open Questions — to resolve with the owner
1. **WebGL-unavailable fallback** — silently fall back to the **Natural Earth flat map** (recommended,
   least surprising) vs. show a "globe needs WebGL" notice vs. a static image?
2. **Atlas maps** — leave the Atlas on the **flat map** (recommended; the pref is about *playing*) vs.
   also render the Atlas on the globe?
3. **Micro-state selectability** — add a **nearest-visible-country snap + minimum tap target**
   (recommended, parity with the flat map's aim-dots) vs. rely on zoom + exact `geoContains` only?
4. **Aesthetic** — keep the **bright Orbi palette + atmosphere glow** (recommended, on-brand) vs. a
   richer "blue-marble" look? Graticule on or off? Idle spin only on the Settings preview, never
   mid-question (recommended)?
5. **Reduce-motion mapping** — confirm `reduceMotion` disables idle spin + damping inertia + fly-to
   tweens (instant camera), consistent with the flat map.
6. **Scope of Stage 2** — ship Stage 1 (globe + both modes basically playable) first for a look, then
   Stage 2 polish; or build the whole phase before review?

### Resolved (clarifying round #2, 2026-07-12)
1. **WebGL fallback:** silently fall back to the **flat Natural Earth** map so play is never broken.
2. **Atlas:** **leave the Atlas on the flat map** — the pref is about playing; globe stays out of Atlas.
3. **Micro-states:** **add nearest-visible-country snap + a minimum tap target** (parity with the flat
   map's aim-dots), operating over front-hemisphere centroids within a capped angular/px radius.
4. **Aesthetic:** keep the **bright Orbi palette + atmosphere glow + graticule**; idle spin only on the
   Settings preview, never mid-question. *(default accepted)*
5. **Reduce-motion:** `reduceMotion` disables idle spin, damping inertia, and fly-to tweens (instant
   camera), matching the flat map. *(default accepted)*
6. **Cadence:** build **Stage 1 first and review** before Stage 2 polish.

## Acceptance criteria
- The player can pick **Globe** in Settings; it persists across reloads and drives **both** map modes.
- Spinning, zooming, and moving between regions are **smooth** (no jank on desktop; acceptable on a
  mid-range phone — verified on device).
- `map-locate` resolves the **exact** clicked country (`geoContains`); the back hemisphere can't be
  clicked; `map-highlight` auto-rotates the prompt into view and rings/pins it.
- Wrong-answer reveal teaches **where the target is** (auto-rotate + label), parity with Phase 22.
- WebGL-absent devices still get a working map (per OQ1); default (non-globe) behaviour is unchanged.
- three.js loads **only** on the globe path and is precached for offline.
- EN/FR/DE parity for new strings; fast loop green (`npm run test` / `check` / `lint`); a headless-Chrome
  check on :5180 switching to Globe and playing a highlight + a locate round.

## Out of scope
- Photorealistic Earth textures / clouds / night lights (a richer skin can be a later pass).
- Globe for the **Atlas** (unless OQ2 says otherwise).
- Changing the flat projections or the Phase-37 flat zoom/pan behaviour.
- New quiz modes or data.

## Progress log
- **2026-07-12 — PRD drafted after clarifying round #1 and a two-prototype spike.** Owner rejected a flat
  SVG orthographic view, then chose **three.js WebGL** over a canvas+versor alternative. Decisions
  recorded above (rotatable, `'globe'` as a 5th projection option, three.js, smooth+playful). Grounded in
  `WorldMap.svelte`, `MapBoard.svelte`, `projection.ts`, `map-hit.ts`, `map-framing.ts`, `Settings.svelte`,
  `Play.svelte`, and the `mapProjection` pref in `persistence/types.ts`. Throwaway prototypes
  (`globe-proto-3d.html`, `globe-proto-canvas.html`) validated texture-on-sphere rendering, raycast +
  `geoContains` picking, `OrbitControls` damping, slerp fly-to-region, and the drop-pin. **NOT built —
  awaiting the Open-Questions round and an explicit build approval.**
- **2026-07-12 — Clarifying round #2 resolved** (see *Resolved* under Open Questions): flat-Natural-Earth
  WebGL fallback, Atlas stays flat, nearest-visible micro-state snap, bright Orbi palette + atmosphere +
  graticule, reduce-motion disables all globe motion, and **Stage 1 ships first for review**. Still NOT
  built — awaiting the owner's explicit "go" to implement Stage 1.
- **2026-07-12 — Stage 1 built & verified** (owner gave the explicit "build stage 1" go). Added `three`
  (^0.185) + `@types/three` as real deps; `'globe'` to the `MapProjection` enum + `MAP_PROJECTIONS` +
  i18n (EN/FR/DE `settings.projection.globe`); pure helpers `globe-geo.ts` (lon/lat↔vec3, texture px,
  antimeridian test) with unit tests; `GlobeMap.svelte` (textured sphere from real geometry, atmosphere
  fresnel glow, `OrbitControls` damped spin/zoom, camera-slerp fly-to/auto-rotate, coral drop-pin,
  raycast+`geoContains` picking); `MapBoard` lazy-imports `GlobeMap` on the globe path with a WebGL
  fallback to flat Natural Earth. Fixed two Phase-28 tests that had used `'globe'` as an invalid example.
  **Fast loop green — `npm run check` 0 errors, `npm run test` 539 passing, `npm run lint` clean.**
  Verified in the real `MapBoard` via headless Chrome (puppeteer, swiftshader WebGL): highlight
  (Brazil filled + pinned + auto-rotated), answered locate (France green / Spain red / pin on target),
  region-framing (Africa filter centres on Africa), and a center-click pick resolving to `GH` — no
  console errors. **Gotcha:** the pinned 5180 dev server must be **restarted after adding a dependency**
  (three) — a server started earlier serves `504 Outdated Optimize Dep` for the new dep's chunk; a
  restart (clearing `node_modules/.vite`) forces re-optimization. Awaiting owner review of Stage 1 before
  Stage 2 (reveal/picked labels, region fit-distance, micro-state snap, +/−/reset controls, full polish).
- **2026-07-12 — Stage 2 built & verified** (owner gave the explicit "build stage 2" go). Added
  billboarded reveal/picked **name labels** (green/red pills, above/below), **region fit-distance**
  framing (`regionAngularRadius` + `fitDistanceForAngularRadius` in `globe-geo.ts`, unit-tested), a
  three-tier **pick** (16 px micro aim-assist → exact `geoContains` → 42 px ocean snap, reusing
  `nearestCountryWithinCap`), the **+/−/reset** zoom-control cluster (dolly), and a **gentle idle spin**
  on the passive preview (off mid-question / under reduced motion). `MapBoard` now passes the label
  props to `GlobeMap`. **Fast loop green — `npm run check` 0 errors, `npm run test` 545 passing,
  `npm run lint` clean.** Production build confirms `GlobeMap`+three is a **separate 563 kB lazy chunk**
  (flat/flag sessions never load three) and is in the **PWA precache** (offline-ready). Verified in the
  real `MapBoard` via puppeteer/swiftshader: answered locate shows France(green)/Spain(red) fills + name
  labels; Europe-filtered locate frames Europe (tightened fit); the + button dollies in; a Europe
  center-click resolves to `FR` (the earlier greedy 26 px micro-cap that grabbed Andorra was cut to
  16 px). **Tuning tweaked mid-verify:** label sprite scale 0.34→0.13 (were dominating the view), micro
  cap 26→16 px, region fit `1.6+2.2r`→`1.5+1.9r`. Pending owner review + an on-device (mobile) check
  before ✅ Done + merge + archive.
