<script lang="ts">
  import { getCountry, type CountryFeature } from '../../data';
  import { projectWorld } from './atlas-map';

  // Display-only world map for the Atlas region page: the whole world in Natural Earth,
  // with every country of `highlightRegion` picked out in the map-highlight turquoise so
  // you can see where the region sits. No interaction, no zoom — regions are shown in
  // context (unlike the game map, which reframes onto a focused subset).
  let {
    features,
    highlightRegion,
    label = '',
  }: {
    /** Country geometry keyed by ISO alpha-2 (from `loadCountryFeatures`). */
    features: Map<string, CountryFeature>;
    /** M49 region whose member countries are highlighted. */
    highlightRegion: string;
    /** Accessible label describing the map. */
    label?: string;
  } = $props();

  // Same logical surface as the game map, so the projection reads identically.
  const WIDTH = 980;
  const HEIGHT = 500;

  const rendered = $derived(projectWorld(features, WIDTH, HEIGHT));
  const highlighted = $derived(
    new Set([...features.keys()].filter((iso2) => getCountry(iso2)?.region === highlightRegion)),
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
          class:hl={highlighted.has(c.iso2)}
          data-iso={c.iso2}
          data-hl={highlighted.has(c.iso2) ? 'true' : 'false'}
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

  .country.hl {
    fill: var(--map-highlight);
    stroke: var(--map-highlight-line);
    stroke-width: 0.9;
  }
</style>
