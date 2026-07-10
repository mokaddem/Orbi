<script lang="ts">
  import { geoPath } from 'd3-geo';
  import type { FeatureCollection } from 'geojson';
  import type { CountryFeature, MapProjection } from '../../data';
  import { t } from '../../i18n';
  import { focusFrame } from './map-framing';
  import { projectionFor } from './projection';

  // Presentational D3-geo world map, shared by both map modes. It renders one SVG
  // path per country (joined geometry keyed by ISO alpha-2) and reports clicks back
  // as ISO codes. Grading, question state, and mode logic all live in the caller
  // (the Play shell) — this component only draws and reports.
  //
  // Modes use it differently:
  //  • map-highlight → non-interactive display: one country is highlighted (with a
  //    pointer ring so even microstates are visible) and the player answers elsewhere.
  //  • map-locate    → interactive: the player clicks a country; once `disabled` the
  //    board locks and reveals the correct (and, if wrong, the picked) country.
  let {
    features,
    highlightIso = null,
    pickedIso = null,
    revealIso = null,
    revealLabel = null,
    focusIsos = null,
    projection = 'naturalEarth',
    interactive = false,
    disabled = false,
    onpick,
  }: {
    /** Country geometry keyed by ISO alpha-2 (from `loadCountryFeatures`). */
    features: Map<string, CountryFeature>;
    /** Country to emphasise as the prompt (map-highlight). */
    highlightIso?: string | null;
    /** Country the player clicked; marked wrong once answered (map-locate). */
    pickedIso?: string | null;
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
    onpick?: (iso2: string) => void;
  } = $props();

  // Fixed logical drawing surface. The SVG scales responsively via its viewBox, so
  // the geometry is projected once (below) and never re-projected on resize.
  const WIDTH = 980;
  const HEIGHT = 500;
  const MARGIN = 6;
  // Projected area (px²) under which a country gets a transparent fallback hit
  // target, so microstates stay clickable in locate mode.
  const SMALL_AREA = 14;

  interface RenderedCountry {
    iso2: string;
    d: string;
    area: number;
    cx: number;
    cy: number;
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
      out.push({ iso2, d, area: path.area(f), cx, cy });
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
</script>

<div class="map">
  <svg
    viewBox="0 0 {WIDTH} {HEIGHT}"
    class:interactive={interactive && !disabled}
    role="group"
    aria-label={$t('play.map.label')}
    preserveAspectRatio="xMidYMid meet"
  >
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
              r="9"
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
            text-anchor={revealMarker.anchor}>{revealLabel}</text
          >
        {/if}
      </g>
    {/if}
  </svg>
</div>

<style>
  .map {
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

  .marker {
    fill: none;
    stroke: var(--color-accent-strong);
    stroke-width: 2;
    opacity: 0.9;
    pointer-events: none;
    animation: marker-in 0.45s ease;
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
    .country {
      transition: none;
    }

    .marker,
    .reveal-ring {
      animation: none;
    }
  }
</style>
