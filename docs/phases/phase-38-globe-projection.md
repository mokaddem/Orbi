# Phase 38 — Play on a 3D globe (WebGL projection)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** 🟡 In progress (Stages 1 + 2 + 3
built & committed; pending owner review + on-device check before ✅ Done) · **Progress:** ~90% ·
**Track:** v2.2 — Dimensional maps

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

### Stage 3 — Owner review fixes & polish ✅ (built & headless-verified 2026-07-13)

> Feedback from the owner's review of the Stages 1 + 2 build (2026-07-12). Built after an explicit "go"
> (2026-07-13). Grounded in the current `GlobeMap.svelte`, `map-framing.ts`, and `WorldMap.svelte`.

- [x] **1 · Region framing must stay on the region (no drift).** Selecting a region should fly to and
      frame *that* region. Today `reframe()` uses `geoCentroid` of the member `FeatureCollection` and an
      angular radius = the farthest member centroid; a region whose M49 membership has a far outlier —
      confirmed **Russia is in "Europe"** (Eastern Europe, reaching ~170°E) — drags the centroid east and
      inflates the radius, so the globe backs off and recenters over Asia with Europe hidden at the limb.
      Fix by reusing Phase 12's robust-framing insight (`map-framing.ts`): reduce members to centroids,
      **trim far outliers** (the same MAD + ~±60° floor gate that already drops Russia-in-Europe on the
      flat map), then derive the fly-to centre **and** angular radius from the kept set.
- [x] **2 · Remove the glow ring.** Delete the additive fresnel **atmosphere sphere** (`atmo`, teal
      `--color-accent`) — the owner reads it as a "green circle/sphere around the globe." Keep the planet;
      drop the halo (and re-check the board's radial-gradient background isn't contributing a ring).
- [x] **3 · Hover feedback — the country pops.** There's no hover affordance today. Add a throttled
      pointer-move raycast → `geoContains` (locate mode only) and give playful feedback so the player sees
      what they're about to pick: the hovered country lifts/brightens. (Approach + fidelity in
      *Stage 3 notes* / *open questions*.)
- [x] **4 · Fix the north-pole band.** A "band" appears near the north pole. Likely the **antimeridian
      ±360° redraw** (Russia/Fiji drawn as three full-width copies) bleeding across the top of the
      equirectangular texture, and/or the polar texel pinch. Replace the 3-copy draw with a proper
      antimeridian **split/clip**, ensure clean ocean to the top edge, and `ClampToEdge` wrap.
- [x] **5 · Crisp borders when zoomed.** Borders come from the raster **CanvasTexture**, so they blur on
      zoom (the flat SVG map stays crisp via non-scaling strokes). Render country **borders as GPU vector
      line geometry** on the sphere (ring coords → `lonLatToVec3` → `LineSegments`), overlaid on the
      textured fills, so borders stay crisp at any zoom. (Higher texture resolution is a fallback, not a
      real fix.)
- [x] **6 · Visible micro-state dots (2D-map parity).** Vatican/Monaco/… are nearly impossible to see or
      hit. Do exactly what `WorldMap` does (Phase 22): a **visible aim-dot** at each micro-state centroid
      (front hemisphere, constant screen size via a sprite), clickable, shown during locate and muted once
      answered. The Stage-2 16 px snap already resolves them — this makes them *visible* so the player
      knows where to aim (the dot == the snappable target).
- [x] **7 · Label callout points at the country.** The reveal/picked name pill is a billboarded sprite
      anchored so the *label+pin midpoint* sits on the country, so it reads as mis-placed. Rework it into a
      **callout whose pointer/leader tip lands exactly on the country's surface point** (like the flat
      map's leader + label), with the pill offset from the tip; and fix the **drop-pin anchor** so its
      *tip* (not centre) sits on the country.

**Shared theme:** items 3, 5, 6 move borders + interactive affordances off the raster texture onto crisp
**GPU geometry** (line borders, dot sprites, hover highlight); fills stay from the texture.

#### Stage 3 — technical notes
- **Region framing:** adapt `map-framing.ts`'s robust centroid trimming to output a globe *centre* +
  *angular radius* (instead of a `fitExtent` MultiPoint box); keep `fitDistanceForAngularRadius`.
- **Borders as lines:** build once from every country's rings → `LineSegments` (thin material); crisp at
  any zoom because the GPU re-rasterises per frame. The hovered/selected country can be a separate,
  brighter/raised line.
- **Hover pop:** raycast on pointermove throttled to ~rAF, `geoContains`; on change, lift + brighten the
  hovered country's border outward (e.g. radius 1.0→~1.02 with a short spring). A *full fill extrusion*
  (whole country lifts) needs per-country triangulated meshes (earcut) — heavier; see OQ.
- **Micro dots:** reuse the Stage-2 micro set (`geoArea < 3e-5` sr); sprites (constant screen size, auto
  billboard, occluded behind the globe) at those centroids; hide on the back hemisphere.
- **Label callout:** project the country surface point and draw a leader (thin line/quad) from it to the
  offset pill; or a pin-shaped sprite whose *tip* is anchored at the point (`sprite.center` at the tip).
- **Pole/antimeridian:** replace the ±360° 3-copy draw with an antimeridian split (or per-ring clip to
  [-180,180] with wrap) — this both removes the top band (item 4) and cleans the texture.

#### Stage 3 — open questions (resolve before building)
1. **Hover "pop" fidelity:** (a) brighten + slightly **lift the hovered country's outline** (light,
   reuses the new border lines — *recommended*) vs (b) a full **geometric extrusion** of the whole
   country (richer pop, needs per-country triangulated meshes + a small earcut dep).
2. **Border architecture:** **vector line borders overlaid on the texture** (*recommended*, smaller
   change) vs a full move to **per-country fill meshes** (fills + borders + hover all geometry; biggest
   change, best long-term, retires the texture).
3. **Micro-dot set:** reuse the Stage-2 `geoArea < 3e-5` sr micro set for the visible dots so the dot ==
   the snappable target (*recommended yes*).

##### Resolved (owner, 2026-07-13)
1. **Hover pop → whole country lifts.** The hovered country rises off the globe like a raised tile
   (option b), settling back on exit. Built as an **on-demand triangulated mesh for the hovered country
   only** (one at a time, so it stays smooth on mobile) — adds a small triangulation dep (**earcut**,
   ~2.5 KB) mapped onto the sphere at an animating radius. This same lift can double as the
   highlight/selection emphasis.
2. **Borders → sharp vector line geometry** overlaid on the texture (option a); country **fills stay from
   the texture**. No full move to per-country fill meshes.
3. **Micro-dots → reuse** the `geoArea < 3e-5` sr snap set, so the visible dot is exactly the snappable
   target.

#### Stage 3 — acceptance criteria
- Selecting any region frames it centred and legible (Europe no longer hidden behind Asia); no drift.
- No atmosphere halo.
- Hovering a country in locate mode gives clear playful feedback (the target pops).
- No polar band; the globe reads clean top-to-bottom.
- Borders stay crisp when zoomed in.
- Micro-states show a visible, clickable dot (as on the 2D map) and are easy to pick.
- The reveal/picked label's pointer lands exactly on the country.
- Fast loop green (`check`/`test`/`lint`); verified headless + an on-device check.

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
  before ✅ Done + merge + archive. Stages 1 + 2 committed on branch `phase-38-globe-projection`
  (`086e3aa`).
- **2026-07-12 — Owner review surfaced 7 fixes → added the Stage 3 spec above.** From playing the
  build: (1) region select drifts off-region (Europe hidden — the Russia-in-Europe outlier inflates the
  centroid/radius), (2) remove the atmosphere "green ring", (3) hover should make a country pop, (4) a
  weird band near the north pole, (5) borders blur when zoomed, (6) micro-states (Vatican) need a visible
  dot like the 2D map, (7) the reveal label's pointer should land on the country, not its own midpoint.
  Confirmed RU is region "Europe"/"Eastern Europe" in the dataset (grounds fix 1). **NOT built — awaiting
  explicit approval; three open questions to resolve first (hover-pop fidelity, border architecture,
  micro-dot set).**
- **2026-07-13 — Stage 3 built & headless-verified** (owner gave the explicit "go ahead and build Stage 3").
  All seven fixes landed, sharing a new **GPU geometry overlay** layer (borders + dots + hover lift) so
  interactive affordances leave the raster texture (fills stay from the texture):
  1. **Region framing** — extracted the flat map's robust MAD + ~±60° outlier trim into a shared
     `robust-stats.ts` (`inlierMask`, used by both `map-framing.focusFrame` and the globe) and added
     `robustRegionFrame` (trimmed **centre + angular radius**) to `globe-geo.ts`; `reframe()` now flies to
     that centre. Russia's centroid is trimmed from "Europe", so Europe frames centred (verified).
  2. **Glow ring** — deleted the additive fresnel `atmo` sphere (+ its now-dead `accent` palette entry).
  3. **Hover pop** — throttled (per-frame) pointermove raycast → bbox-reject → `geoContains` (locate mode
     only) lifts the hovered country as an on-demand **earcut**-triangulated tile (radius spring 1→1.035,
     instant under reduced motion). New dep **earcut** (^3.2, ~2.5 KB) in the globe chunk only.
  4. **North-pole band** — root cause was Russia/Fiji rings carrying the antimeridian seam *inside* one
     ring (vertices at ±180 → a full-width texture smear at ~65–71°N). Replaced the ±360° 3-copy draw with
     a pure `splitRingAtAntimeridian` (cuts each crossing edge at ±180, splices the wrap) + `ClampToEdge`
     wrap. Verified on the real data (worst post-split |Δlon| = 1.7°) and headless (clean Arctic).
  5. **Crisp borders** — country outlines built once as GPU `LineSegments` (`appendBorderSegments`,
     antimeridian-split), overlaid at radius 1.0015; the texture stroke is dropped (fills only). Crisp at
     any zoom vs. the old blurry raster.
  6. **Micro-state dots** — a `THREE.Points` layer (constant screen size, depth-tested so back-hemisphere
     dots hide) at each `geoArea < 3e-5` sr centroid — the same snap set, so the visible dot *is* the
     target; muted on answer, target's own dot dropped (pin/label instead), mirroring the flat map.
  7. **Label callout + pin** — reveal/picked pills reworked into one billboarded sprite each (pill + a
     downward leader stem + a tip dot), anchored at the tip so the pointer lands exactly on the country's
     surface (green stem longer, red shorter, so adjacent France/Spain pills clear each other); the pin is
     re-anchored at its **tip** (`sprite.center`) so it stands on the country.

  **Fast loop green** — `npm run check` 0 errors, `npm run test` **562 passing** (+ new `robust-stats` and
  `globe-geo` split/border/frame tests), `npm run lint` clean. **Production build:** `GlobeMap` is still a
  separate lazy chunk (**579 kB / 147 kB gz**, three + earcut; +~16 kB vs Stage 2) and in the PWA precache
  (offline-ready); `robust-stats` split to a 1.8 kB shared chunk. **Headless-verified** (puppeteer /
  swiftshader) across all seven: Europe framed centred with micro dots, no glow ring, Czechia pops on
  hover, clean pole, crisp zoomed borders, France/Spain callouts landing on their countries. Committed on
  `phase-38-globe-projection` (`b763f03`). **Pending owner review + an on-device (mobile) check before
  ✅ Done + merge + archive.**
- **2026-07-13 — Stage 3 review round 2 (owner feedback on the built globe).** Four tweaks: (a) **more
  globe/background separation** — the `.globe` board now uses a deep cool-teal "space" gradient so the
  pale planet reads clearly (the glow ring is gone, so the background carries the contrast); (b) **removed
  the drop-pin** entirely — the reveal target is marked by its name callout + leader alone (highlight mode
  by its turquoise fill); (c) **micro-state dots get a hover animation** — a single pulsing dot grows over
  the hovered dot (locate-mode, micro-first precedence over the tile lift; static under reduced motion);
  (d) **softened the large-country hover pop** (`LIFT_MAX` 1.035 → 1.026). Fast loop green (562 tests);
  headless-verified all four (incl. a Vatican-framed micro-hover shot). Still pending owner review +
  on-device check before ✅ Done.
