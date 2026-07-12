<script lang="ts">
  import { untrack } from 'svelte';
  import { geoPath } from 'd3-geo';
  import { pointer, select } from 'd3-selection';
  import {
    zoom as d3zoom,
    zoomIdentity,
    type D3ZoomEvent,
    type ZoomBehavior,
    type ZoomTransform,
  } from 'd3-zoom';
  import type { FeatureCollection } from 'geojson';
  import type { CountryFeature, MapProjection } from '../../data';
  import { t } from '../../i18n';
  import Icon from './Icon.svelte';
  import { focusFrame } from './map-framing';
  import { nearestCountryWithinCap } from './map-hit';
  import { projectionFor } from './projection';

  // Presentational D3-geo world map, shared by both map modes. It renders one SVG
  // path per country (joined geometry keyed by ISO alpha-2) and reports clicks back
  // as ISO codes. Grading, question state, and mode logic all live in the caller
  // (the Play shell) — this component only draws and reports.
  //
  // Modes use it differently:
  //  • map-highlight → non-interactive display: one country is highlighted (with a
  //    pointer ring so even microstates are visible) and the player answers elsewhere.
  //    On a large board the map gently auto-zooms to frame the ringed prompt (Phase 37).
  //  • map-locate    → interactive: the player clicks a country; once `disabled` the
  //    board locks and reveals the correct (and, if wrong, the picked) country.
  //
  // Phase 37 adds pan/zoom (d3-zoom over a single transform layer — the projection is
  // still computed once, never re-projected) and *nearest-country snap*: a tap that
  // lands on open water resolves to the nearest country within a capped distance, so
  // small countries are selectable without pixel-perfect aim. Grading stays exact — a
  // direct hit on a country/dot wins, and a snap resolves to a single ISO that the
  // caller grades (a neighbour/ocean tap never falsely validates the target).
  let {
    features,
    highlightIso = null,
    pickedIso = null,
    pickedLabel = null,
    revealIso = null,
    revealLabel = null,
    focusIsos = null,
    projection = 'naturalEarth',
    interactive = false,
    disabled = false,
    reduceMotion = false,
    questionKey = null,
    onpick,
  }: {
    /** Country geometry keyed by ISO alpha-2 (from `loadCountryFeatures`). */
    features: Map<string, CountryFeature>;
    /** Country to emphasise as the prompt (map-highlight). */
    highlightIso?: string | null;
    /** Country the player clicked; marked wrong once answered (map-locate). */
    pickedIso?: string | null;
    /**
     * Localised name of the wrong pick, drawn as a red on-map label so the player sees
     * *which* country they actually selected (map-locate, Phase 35). Only set on a wrong
     * answer; ignored when the pick equals the reveal target.
     */
    pickedLabel?: string | null;
    /** Correct country to reveal in green once answered (map-locate). */
    revealIso?: string | null;
    /**
     * Localised name of the reveal target, drawn as an on-map label so the player
     * learns *where* it is (Phase 22). Only shown when `revealIso` is set.
     */
    revealLabel?: string | null;
    /**
     * ISO alpha-2 codes to zoom/fit the projection to (the active region filter).
     * `null` / empty fits the whole world. Every country is still drawn; this only
     * changes the framing so a filtered region fills the board. Pass a *stable*
     * reference (it doesn't change within a session) so the projection is memoized.
     */
    focusIsos?: string[] | null;
    /**
     * Which D3 projection to draw with (Phase 28, from the `mapProjection` pref). A
     * config-level choice, not per-question — changing it re-projects once. Pass a
     * *stable* value within a session so the projection stays memoized.
     */
    projection?: MapProjection;
    /** Whether clicks resolve to a pick (map-locate) vs. display-only (map-highlight). */
    interactive?: boolean;
    /** Locks interaction after an answer is submitted. */
    disabled?: boolean;
    /** Skip zoom/auto-zoom animation (in-app Reduce-animation pref, Phase 37). */
    reduceMotion?: boolean;
    /**
     * A value that changes once per question. When it changes the board re-frames:
     * map-locate resets to the default region/world framing; map-highlight auto-zooms
     * to the new prompt country. Needed because a fresh locate question's other props
     * are indistinguishable from the previous one.
     */
    questionKey?: string | number | null;
    onpick?: (iso2: string) => void;
  } = $props();

  // Fixed logical drawing surface. The SVG scales responsively via its viewBox, so
  // the geometry is projected once (below) and never re-projected on resize or zoom.
  const WIDTH = 980;
  const HEIGHT = 500;
  const MARGIN = 6;
  // Projected area (px²) under which a country gets a visible aim dot, so microstates
  // stay clickable in locate mode.
  const SMALL_AREA = 14;

  // Zoom + snap tuning (Phase 37).
  const MAX_ZOOM = 8; // deepest interactive zoom
  const ZOOM_STEP = 1.6; // +/- button factor
  const ZOOM_MS = 350; // animated re-frame duration (0 when reduce-motion)
  const CLICK_DISTANCE = 12; // viewBox units a tap may drift before it counts as a pan
  const SNAP_CAP = 44; // nearest-country snap radius, in logical units
  const DOT_R = 9; // aim-dot radius at k=1 (counter-scaled so it stays ~constant on screen)
  const REVEAL_FONT = 22; // reveal label px at k=1 (counter-scaled while zoomed)
  const PICKED_FONT = 20; // wrong-pick label px at k=1
  const HIGHLIGHT_FILL = 0.5; // fraction of the board the auto-zoomed highlight should fill
  const HIGHLIGHT_MAX_ZOOM = 5; // gentle cap so a microstate highlight doesn't slam all the way in

  type Bounds = [number, number, number, number];

  interface RenderedCountry {
    iso2: string;
    d: string;
    area: number;
    cx: number;
    cy: number;
    bounds: Bounds | null;
  }

  // Project every country once. Recomputes only if `features`, `focusIsos`, or
  // `projection` change (none does during a session), so switching questions never
  // re-runs the math.
  // The projection is *fit* to the focused subset when one is given (zooming the
  // board into the active region) but still renders every country for context.
  //
  // Framing a filtered region uses a robust MultiPoint over the members' centroids
  // (see `map-framing.ts`) rather than their full geometry, so sprawling members like
  // Russia don't blow the box out to half the globe. Unfiltered → fit the whole world.
  const rendered = $derived.by<RenderedCountry[]>(() => {
    const focus = focusIsos
      ? focusIsos.map((iso) => features.get(iso)).filter((f): f is CountryFeature => !!f)
      : [];
    const frame = focusFrame(focus);
    const fitTarget =
      frame ??
      ({ type: 'FeatureCollection', features: [...features.values()] } satisfies FeatureCollection);
    const proj = projectionFor(projection).fitExtent(
      [
        [MARGIN, MARGIN],
        [WIDTH - MARGIN, HEIGHT - MARGIN],
      ],
      fitTarget,
    );
    const path = geoPath(proj);
    const out: RenderedCountry[] = [];
    for (const [iso2, f] of features) {
      const d = path(f);
      if (!d) continue;
      const [cx, cy] = path.centroid(f);
      const [[bx0, by0], [bx1, by1]] = path.bounds(f);
      const bounds: Bounds | null =
        Number.isFinite(bx0) && Number.isFinite(by0) && Number.isFinite(bx1) && Number.isFinite(by1)
          ? [bx0, by0, bx1, by1]
          : null;
      out.push({ iso2, d, area: path.area(f), cx, cy, bounds });
    }
    return out;
  });

  // Transparent boost targets for tiny countries (locate mode only), so they can be
  // tapped without pixel-perfect aim. Sorted smallest-first so the tiniest wins overlap.
  const hitDots = $derived(
    interactive
      ? rendered
          .filter((r) => r.area < SMALL_AREA && Number.isFinite(r.cx) && Number.isFinite(r.cy))
          .sort((a, b) => a.area - b.area)
      : [],
  );

  // Pointer ring drawing attention to the highlighted country (map-highlight), sized
  // to the country but with a floor so microstates remain visible.
  const marker = $derived.by(() => {
    if (!highlightIso) return null;
    const item = rendered.find((r) => r.iso2 === highlightIso);
    if (!item || !Number.isFinite(item.cx) || !Number.isFinite(item.cy)) return null;
    const r = Math.min(40, Math.max(13, Math.sqrt(item.area) * 0.75));
    return { cx: item.cx, cy: item.cy, r };
  });

  // Target-first reveal (map-locate, once answered): a name label on the country the
  // player was asked to locate, so a wrong answer teaches *where it is* (Phase 22)
  // rather than drawing the eye to the wrong pick. The label is offset with a leader
  // and flips side/clamps vertically to stay on the board.
  //
  // The ring is drawn *only for micro-states* — the countries small enough to get an
  // aim dot (`area < SMALL_AREA`). A normal-sized country is already unmistakable from
  // its green fill, so a ring on top just clutters it (owner feedback); the ring earns
  // its place only where the fill is too small to see. Radius floors so that micro-state
  // ring stays legible.
  const revealMarker = $derived.by(() => {
    if (!revealIso) return null;
    const item = rendered.find((r) => r.iso2 === revealIso);
    if (!item || !Number.isFinite(item.cx) || !Number.isFinite(item.cy)) return null;
    const micro = item.area < SMALL_AREA;
    const r = Math.min(40, Math.max(11, Math.sqrt(item.area) * 0.9));
    const dir = item.cx < WIDTH * 0.72 ? 1 : -1;
    const lx = item.cx + dir * (r + 26);
    const ly = Math.max(24, item.cy - (r + 16));
    return { cx: item.cx, cy: item.cy, r, lx, ly, anchor: dir > 0 ? 'start' : 'end', micro };
  });

  // The wrong pick's name label (map-locate, once answered). Mirrors the reveal marker
  // but is painted red and its label is offset *downward* — the reveal label goes up — so
  // the two never collide when the pick and target sit near each other. A ring is drawn
  // only for micro picks, where the faint red fill is too small to spot on its own.
  const pickedMarker = $derived.by(() => {
    if (!pickedLabel || !pickedIso || pickedIso === revealIso) return null;
    const item = rendered.find((r) => r.iso2 === pickedIso);
    if (!item || !Number.isFinite(item.cx) || !Number.isFinite(item.cy)) return null;
    const micro = item.area < SMALL_AREA;
    const r = Math.min(40, Math.max(11, Math.sqrt(item.area) * 0.9));
    const dir = item.cx < WIDTH * 0.72 ? 1 : -1;
    const lx = item.cx + dir * (r + 26);
    const ly = Math.min(HEIGHT - 12, item.cy + (r + 16));
    return { cx: item.cx, cy: item.cy, r, lx, ly, anchor: dir > 0 ? 'start' : 'end', micro };
  });

  type FillState = 'reveal' | 'picked-wrong' | 'highlight' | '';

  function stateFor(iso2: string): FillState {
    if (iso2 === revealIso) return 'reveal';
    if (iso2 === pickedIso && iso2 !== revealIso) return 'picked-wrong';
    if (iso2 === highlightIso) return 'highlight';
    return '';
  }

  function pick(iso2: string): void {
    if (!interactive || disabled) return;
    onpick?.(iso2);
  }

  // A tap that lands on open water (the ocean-hit rect below the countries) snaps to the
  // nearest country centroid within the cap. `pointer(event, zoomLayer)` maps the tap
  // into logical coords through the current zoom transform, so the cap stays meaningful
  // at every zoom level. Beyond the cap → no-op (the question stays open).
  function onOceanPick(event: MouseEvent): void {
    if (!interactive || disabled || !zoomLayer) return;
    const [x, y] = pointer(event, zoomLayer);
    const iso = nearestCountryWithinCap(x, y, rendered, SNAP_CAP);
    if (iso) pick(iso);
  }

  // --- Zoom / pan (Phase 37) ------------------------------------------------------
  // DOM refs are `$state` so the setup / listener-attach effects re-run once
  // `bind:this` populates them.
  let svgEl = $state<SVGSVGElement>();
  let zoomLayer = $state<SVGGElement>();
  let oceanEl = $state<SVGRectElement>();
  let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | undefined;
  let zoomTransform = $state<ZoomTransform>(zoomIdentity);
  let tweenRaf = 0;

  const transformAttr = $derived(
    `translate(${zoomTransform.x} ${zoomTransform.y}) scale(${zoomTransform.k})`,
  );
  const zoomK = $derived(zoomTransform.k);
  const zoomed = $derived(zoomTransform.k > 1.001);

  function motionMs(): number {
    if (reduceMotion) return 0;
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return 0;
    return ZOOM_MS;
  }

  const easeInOut = (p: number): number =>
    p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

  function cancelTween(): void {
    if (tweenRaf) {
      cancelAnimationFrame(tweenRaf);
      tweenRaf = 0;
    }
  }

  // Animate the zoom transform to `target`. We tween by hand (a short rAF lerp) rather
  // than pull in d3-transition — `zoomBehavior.transform` on each frame keeps d3-zoom's
  // own state in sync and re-applies its scale/translate constraints.
  function animateTo(target: ZoomTransform, dur: number): void {
    if (!svgEl || !zoomBehavior) return;
    cancelTween();
    const sel = select(svgEl);
    if (dur <= 0) {
      sel.call(zoomBehavior.transform, target);
      return;
    }
    // `untrack`: this is just the tween's starting snapshot. Read plainly, it would
    // subscribe the re-frame `$effect` (which calls `animateTo`) to `zoomTransform`, so
    // every tween frame would re-run the effect → restart the re-frame → cancel the tween.
    // That feedback loop pins the board at its default framing and makes the +/−/reset
    // controls appear dead in motion mode (the instant path returns above, so it was fine).
    const from = untrack(() => zoomTransform);
    const t0 = performance.now();
    const step = (now: number): void => {
      const p = Math.min(1, (now - t0) / dur);
      const e = easeInOut(p);
      const k = from.k + (target.k - from.k) * e;
      const x = from.x + (target.x - from.x) * e;
      const y = from.y + (target.y - from.y) * e;
      if (svgEl && zoomBehavior) {
        select(svgEl).call(zoomBehavior.transform, zoomIdentity.translate(x, y).scale(k));
      }
      if (p < 1) tweenRaf = requestAnimationFrame(step);
      else tweenRaf = 0;
    };
    tweenRaf = requestAnimationFrame(step);
  }

  function boundsTransform([x0, y0, x1, y1]: Bounds): ZoomTransform {
    const bw = Math.max(1e-3, x1 - x0);
    const bh = Math.max(1e-3, y1 - y0);
    const k = Math.min(
      HIGHLIGHT_MAX_ZOOM,
      Math.max(1, HIGHLIGHT_FILL * Math.min(WIDTH / bw, HEIGHT / bh)),
    );
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    return zoomIdentity.translate(WIDTH / 2 - k * cx, HEIGHT / 2 - k * cy).scale(k);
  }

  function scaleByCentered(factor: number): void {
    const cur = zoomTransform;
    const k = Math.min(MAX_ZOOM, Math.max(1, cur.k * factor));
    // Keep the board centre fixed while scaling.
    const dx = (WIDTH / 2 - cur.x) / cur.k;
    const dy = (HEIGHT / 2 - cur.y) / cur.k;
    animateTo(zoomIdentity.translate(WIDTH / 2 - k * dx, HEIGHT / 2 - k * dy).scale(k), motionMs());
  }

  function resetView(): void {
    animateTo(zoomIdentity, motionMs());
  }

  // Re-frame the board when the question (or highlight target) changes: map-highlight
  // auto-zooms to the ringed prompt; map-locate returns to the default region/world
  // framing so each question starts from a predictable view. Also does the one-time
  // d3-zoom setup once the SVG is mounted. Reactive deps (questionKey, highlightIso,
  // rendered) are read up-front so the effect re-runs per question even if the zoom
  // wasn't ready on the first pass.
  $effect(() => {
    const key = questionKey;
    const hi = highlightIso;
    const items = rendered;
    void key;

    if (svgEl && !zoomBehavior) {
      const z = d3zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, MAX_ZOOM])
        .extent([
          [0, 0],
          [WIDTH, HEIGHT],
        ])
        .translateExtent([
          [0, 0],
          [WIDTH, HEIGHT],
        ])
        .clickDistance(CLICK_DISTANCE)
        .on('start', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
          // A user gesture takes over from any in-flight auto-zoom tween.
          if (event.sourceEvent) cancelTween();
        })
        .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
          zoomTransform = event.transform;
        });
      const sel = select(svgEl);
      sel.call(z);
      // Drop double-click-to-zoom: in locate a fast double-tap would fight instant picks.
      sel.on('dblclick.zoom', null);
      zoomBehavior = z;
    }
    if (!svgEl || !zoomBehavior) return;

    const dur = motionMs();
    if (hi) {
      const item = items.find((r) => r.iso2 === hi);
      if (item?.bounds) {
        animateTo(boundsTransform(item.bounds), dur);
        return;
      }
    }
    animateTo(zoomIdentity, dur);
  });

  // Attach the ocean-hit snap handler as a plain d3 click listener (not a Svelte
  // `onclick`), so it stays a pointer-only affordance with no interactive-element a11y
  // semantics. d3-zoom's own click suppression (a moved gesture cancels the trailing
  // click) applies here too, so a pan never fires a stray snap.
  $effect(() => {
    if (!oceanEl) return;
    const sel = select(oceanEl);
    sel.on('click', (event: MouseEvent) => onOceanPick(event));
    return () => {
      sel.on('click', null);
    };
  });

  $effect(() => () => cancelTween());
</script>

<div class="map">
  <svg
    bind:this={svgEl}
    viewBox="0 0 {WIDTH} {HEIGHT}"
    class:interactive={interactive && !disabled}
    class:zoomed
    role="group"
    aria-label={$t('play.map.label')}
    preserveAspectRatio="xMidYMid meet"
  >
    <g class="zoom-layer" bind:this={zoomLayer} transform={transformAttr}>
      {#if interactive}
        <!-- Below the countries: catches taps that miss every country so they can snap to
             the nearest one. Countries paint on top, so a direct hit still wins. Its click
             handler is attached via d3 (below) rather than a Svelte `onclick`: it's a
             pointer-only forgiveness aid (keyboard/SR users select via the country/dot
             buttons above — map selection by keyboard is out of scope), so it's aria-hidden
             and carries no interactive-element semantics. -->
        <rect
          class="ocean-hit"
          bind:this={oceanEl}
          x="0"
          y="0"
          width={WIDTH}
          height={HEIGHT}
          aria-hidden="true"
        />
      {/if}

      <g class="countries">
        {#each rendered as c (c.iso2)}
          {@const st = stateFor(c.iso2)}
          <path
            d={c.d}
            class="country {st}"
            data-iso={c.iso2}
            data-state={st}
            role={interactive ? 'button' : undefined}
            aria-label={interactive ? c.iso2 : undefined}
            onclick={() => pick(c.iso2)}
          />
        {/each}
      </g>

      {#if hitDots.length}
        <g class="hit-dots">
          {#each hitDots as c (c.iso2)}
            <!-- The target's own dot is replaced by the reveal ring once answered. -->
            {#if !(disabled && c.iso2 === revealIso)}
              <circle
                class="dot"
                class:muted={disabled}
                cx={c.cx}
                cy={c.cy}
                r={DOT_R / zoomK}
                data-iso={c.iso2}
                data-hit="dot"
                role={interactive ? 'button' : undefined}
                aria-label={interactive ? c.iso2 : undefined}
                onclick={() => pick(c.iso2)}
              />
            {/if}
          {/each}
        </g>
      {/if}

      {#if marker}
        <circle class="marker" cx={marker.cx} cy={marker.cy} r={marker.r} />
      {/if}

      {#if revealMarker}
        <g class="reveal-target">
          {#if revealLabel}
            <line
              class="reveal-leader"
              x1={revealMarker.cx}
              y1={revealMarker.cy}
              x2={revealMarker.lx}
              y2={revealMarker.ly}
            />
          {/if}
          {#if revealMarker.micro}
            <circle
              class="reveal-ring"
              cx={revealMarker.cx}
              cy={revealMarker.cy}
              r={revealMarker.r}
            />
          {/if}
          {#if revealLabel}
            <text
              class="reveal-label"
              x={revealMarker.lx}
              y={revealMarker.ly}
              style:font-size="{REVEAL_FONT / zoomK}px"
              text-anchor={revealMarker.anchor}>{revealLabel}</text
            >
          {/if}
        </g>
      {/if}

      {#if pickedMarker}
        <g class="picked-target">
          <line
            class="picked-leader"
            x1={pickedMarker.cx}
            y1={pickedMarker.cy}
            x2={pickedMarker.lx}
            y2={pickedMarker.ly}
          />
          {#if pickedMarker.micro}
            <circle
              class="picked-ring"
              cx={pickedMarker.cx}
              cy={pickedMarker.cy}
              r={pickedMarker.r}
            />
          {/if}
          <text
            class="picked-label"
            x={pickedMarker.lx}
            y={pickedMarker.ly}
            style:font-size="{PICKED_FONT / zoomK}px"
            text-anchor={pickedMarker.anchor}>{pickedLabel}</text
          >
        </g>
      {/if}
    </g>
  </svg>

  <div class="map-controls">
    <button
      type="button"
      onclick={() => scaleByCentered(ZOOM_STEP)}
      aria-label={$t('play.map.zoomIn')}
    >
      <Icon name="plus" />
    </button>
    <button
      type="button"
      onclick={() => scaleByCentered(1 / ZOOM_STEP)}
      aria-label={$t('play.map.zoomOut')}
    >
      <Icon name="minus" />
    </button>
    {#if zoomed}
      <button type="button" onclick={resetView} aria-label={$t('play.map.reset')}>
        <Icon name="maximize" />
      </button>
    {/if}
  </div>
</div>

<style>
  .map {
    position: relative;
    width: 100%;
    background: var(--map-water);
    border: 2px solid var(--map-border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    /* Own touch gestures so pinch/drag pan-zoom the board rather than scroll the page. */
    touch-action: none;
  }

  /* Strokes are inside the zoom layer, so keep them crisp (constant width) at any zoom. */
  .country,
  .dot,
  .marker,
  .reveal-ring,
  .picked-ring,
  .reveal-leader,
  .picked-leader,
  .reveal-label,
  .picked-label {
    vector-effect: non-scaling-stroke;
  }

  .ocean-hit {
    fill: none;
    pointer-events: all;
  }

  .country {
    fill: var(--map-land);
    stroke: var(--map-border);
    stroke-width: 0.5;
    stroke-linejoin: round;
    transition:
      fill 0.15s ease,
      stroke 0.15s ease;
  }

  svg.interactive .country {
    cursor: pointer;
  }

  /* Locate mode: a muted-land hover is too subtle, so use a clear accent tint. */
  svg.interactive .country:hover {
    fill: var(--map-land-hover);
    stroke: var(--color-accent);
    stroke-width: 0.8;
  }

  .country.highlight {
    fill: var(--map-highlight);
    stroke: var(--map-highlight-line);
    stroke-width: 1.1;
  }

  .country.reveal {
    fill: var(--color-correct);
    stroke: var(--color-correct);
    stroke-width: 0.9;
  }

  /* The wrong pick is kept as muted secondary context so the reveal target leads. */
  .country.picked-wrong {
    fill: var(--color-wrong);
    fill-opacity: 0.3;
    stroke: var(--color-wrong);
    stroke-opacity: 0.55;
    stroke-width: 0.8;
  }

  /* Micro-state aim points: visible during locate play, dimmed once answered so the
     reveal stands out. Painted above country paths, so a click resolves to the tiny
     target (never its larger neighbour). */
  .dot {
    fill: var(--color-accent-strong);
    stroke: #fff;
    stroke-width: 1;
    cursor: pointer;
    /* Grow from the dot's own centre on hover (not the SVG origin). */
    transform-box: fill-box;
    transform-origin: center;
    transition:
      transform 0.12s ease,
      fill 0.12s ease;
  }

  /* Hover feedback: the dot swells and brightens so a player aiming at a tiny country
     is sure the pointer is on it before committing the click. */
  svg.interactive .dot:hover {
    transform: scale(1.6);
    fill: var(--color-accent);
  }

  .dot.muted {
    opacity: 0.3;
    cursor: default;
  }

  .reveal-ring {
    fill: none;
    stroke: var(--color-correct);
    stroke-width: 3;
    animation: marker-in 0.45s ease;
  }

  .reveal-leader {
    stroke: var(--color-correct);
    stroke-width: 1.5;
  }

  .reveal-label {
    font:
      600 22px system-ui,
      sans-serif;
    fill: var(--color-text);
    paint-order: stroke;
    stroke: var(--map-water);
    stroke-width: 4;
    stroke-linejoin: round;
  }

  /* The wrong pick's name, in the "wrong" red so it reads as the mistake — distinct from
     the green reveal target it sits beneath. */
  .picked-ring {
    fill: none;
    stroke: var(--color-wrong);
    stroke-width: 3;
    animation: marker-in 0.45s ease;
  }

  .picked-leader {
    stroke: var(--color-wrong);
    stroke-width: 1.5;
  }

  .picked-label {
    font:
      600 20px system-ui,
      sans-serif;
    fill: var(--color-wrong);
    paint-order: stroke;
    stroke: var(--map-water);
    stroke-width: 4;
    stroke-linejoin: round;
  }

  .marker {
    fill: none;
    stroke: var(--color-accent-strong);
    stroke-width: 2;
    opacity: 0.9;
    pointer-events: none;
    animation: marker-in 0.45s ease;
  }

  /* Zoom controls — a small cluster in the corner (Phase 37). */
  .map-controls {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .map-controls button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-surface) 88%, transparent);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.15);
    transition:
      background 0.12s ease,
      transform 0.12s ease;
  }

  .map-controls button:hover {
    background: var(--color-surface);
  }

  .map-controls button:active {
    transform: scale(0.92);
  }

  @keyframes marker-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 0.9;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .country,
    .dot,
    .map-controls button {
      transition: none;
    }

    .marker,
    .reveal-ring,
    .picked-ring {
      animation: none;
    }
  }
</style>
