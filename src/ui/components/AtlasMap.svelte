<script lang="ts">
  import { getCountry, type CountryFeature } from '../../data';
  import { projectWorld } from './atlas-map';

  // Display-only world map for the Atlas. Two modes, same Natural Earth surface as the game
  // map (so the projection reads identically), no interaction, no zoom — places are shown in
  // context rather than reframed:
  //  • Region mode (`highlightRegion`): every member country of the region is picked out in
  //    the map-highlight turquoise (used by the region-detail page).
  //  • Country mode (`highlightCountry`): the one country is the bright focus, and its region
  //    is softly tinted around it as a locator (used by the country-detail page).
  let {
    features,
    highlightRegion = '',
    highlightCountry = null,
    label = '',
  }: {
    /** Country geometry keyed by ISO alpha-2 (from `loadCountryFeatures`). */
    features: Map<string, CountryFeature>;
    /** M49 region whose member countries are highlighted (region mode). */
    highlightRegion?: string;
    /** ISO alpha-2 of a single country to focus, with its region tinted (country mode). */
    highlightCountry?: string | null;
    /** Accessible label describing the map. */
    label?: string;
  } = $props();

  // Same logical surface as the game map, so the projection reads identically.
  const WIDTH = 980;
  const HEIGHT = 500;

  const rendered = $derived(projectWorld(features, WIDTH, HEIGHT));

  const focusIso = $derived(highlightCountry ?? null);
  // The region to colour: explicit in region mode, else the focus country's own region.
  const contextRegion = $derived(focusIso ? (getCountry(focusIso)?.region ?? '') : highlightRegion);
  const regionMembers = $derived(
    new Set(
      [...features.keys()].filter(
        (iso2) => contextRegion && getCountry(iso2)?.region === contextRegion,
      ),
    ),
  );
</script>

<div class="map">
  <svg
    viewBox="0 0 {WIDTH} {HEIGHT}"
    role="img"
    aria-label={label}
    preserveAspectRatio="xMidYMid meet"
  >
    <g class="countries">
      {#each rendered as c (c.iso2)}
        <path
          d={c.d}
          class="country"
          class:hl={!focusIso && regionMembers.has(c.iso2)}
          class:context={focusIso !== null && c.iso2 !== focusIso && regionMembers.has(c.iso2)}
          class:focus={c.iso2 === focusIso}
          data-iso={c.iso2}
          data-hl={regionMembers.has(c.iso2) || c.iso2 === focusIso ? 'true' : 'false'}
        />
      {/each}
    </g>
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
  }

  /* Region mode: every member picked out in the highlight turquoise. */
  .country.hl {
    fill: var(--map-highlight);
    stroke: var(--map-highlight-line);
    stroke-width: 0.9;
  }

  /* Country mode: the focus country's region, softly tinted as a locator backdrop… */
  .country.context {
    fill: var(--map-highlight);
    fill-opacity: 0.32;
    stroke: var(--map-highlight-line);
    stroke-width: 0.5;
  }

  /* …and the country itself, the bright, boldly-outlined focus on top of it. */
  .country.focus {
    fill: var(--map-highlight);
    stroke: var(--map-highlight-line);
    stroke-width: 1.6;
  }
</style>
