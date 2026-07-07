<script lang="ts">
  import { geoNaturalEarth1, geoPath } from 'd3-geo';
  import type { FeatureCollection } from 'geojson';
  import type { CountryFeature } from '../../data';
  import { t } from '../../i18n';

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
    focusIsos = null,
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
     * ISO alpha-2 codes to zoom/fit the projection to (the active region filter).
     * `null` / empty fits the whole world. Every country is still drawn; this only
     * changes the framing so a filtered region fills the board. Pass a *stable*
     * reference (it doesn't change within a session) so the projection is memoized.
     */
    focusIsos?: string[] | null;
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

  // Project every country once. Recomputes only if `features` or `focusIsos` change
  // (neither does during a session), so switching questions never re-runs the math.
  // The projection is *fit* to the focused subset when one is given (zooming the
  // board into the active region) but still renders every country for context.
  const rendered = $derived.by<RenderedCountry[]>(() => {
    const focus = focusIsos
      ? focusIsos.map((iso) => features.get(iso)).filter((f): f is CountryFeature => !!f)
      : [];
    const fitList = focus.length > 0 ? focus : [...features.values()];
    const collection: FeatureCollection = { type: 'FeatureCollection', features: fitList };
    const projection = geoNaturalEarth1().fitExtent(
      [
        [MARGIN, MARGIN],
        [WIDTH - MARGIN, HEIGHT - MARGIN],
      ],
      collection,
    );
    const path = geoPath(projection);
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
          <circle
            cx={c.cx}
            cy={c.cy}
            r="9"
            data-iso={c.iso2}
            data-hit="dot"
            role={interactive ? 'button' : undefined}
            aria-label={interactive ? c.iso2 : undefined}
            onclick={() => pick(c.iso2)}
          />
        {/each}
      </g>
    {/if}

    {#if marker}
      <circle class="marker" cx={marker.cx} cy={marker.cy} r={marker.r} />
    {/if}
  </svg>
</div>

<style>
  .map {
    width: 100%;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .country {
    fill: var(--color-bg);
    stroke: var(--color-border);
    stroke-width: 0.4;
    stroke-linejoin: round;
    transition:
      fill 0.12s ease,
      stroke 0.12s ease;
  }

  svg.interactive .country {
    cursor: pointer;
  }

  svg.interactive .country:hover {
    fill: var(--color-accent);
    fill-opacity: 0.45;
  }

  .country.highlight {
    fill: var(--color-accent);
    stroke: var(--color-accent);
    stroke-width: 0.8;
  }

  .country.reveal {
    fill: var(--color-correct);
    stroke: var(--color-correct);
    stroke-width: 0.8;
  }

  .country.picked-wrong {
    fill: var(--color-wrong);
    stroke: var(--color-wrong);
    stroke-width: 0.8;
  }

  .hit-dots circle {
    fill: transparent;
    cursor: pointer;
  }

  .marker {
    fill: none;
    stroke: var(--color-accent);
    stroke-width: 2;
    opacity: 0.9;
    pointer-events: none;
  }
</style>
