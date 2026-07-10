<script lang="ts">
  import { onMount } from 'svelte';
  import { loadCountryFeatures, type CountryFeature, type MapProjection } from '../../data';
  import { t } from '../../i18n';
  import WorldMap from './WorldMap.svelte';

  // Async wrapper around WorldMap: it fetches + decodes the bundled TopoJSON on mount
  // (memoized in the data layer, so it runs at most once per session) and shows a
  // loading / error state until ready. Play lazy-imports *this* component, which keeps
  // d3-geo and the geometry chunk out of the bundle for flag-only sessions.
  let {
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
    highlightIso?: string | null;
    pickedIso?: string | null;
    revealIso?: string | null;
    revealLabel?: string | null;
    focusIsos?: string[] | null;
    projection?: MapProjection;
    interactive?: boolean;
    disabled?: boolean;
    onpick?: (iso2: string) => void;
  } = $props();

  let features = $state<Map<string, CountryFeature> | null>(null);
  let failed = $state(false);

  onMount(async () => {
    try {
      features = await loadCountryFeatures();
    } catch {
      failed = true;
    }
  });
</script>

{#if features}
  <WorldMap
    {features}
    {highlightIso}
    {pickedIso}
    {revealIso}
    {revealLabel}
    {focusIsos}
    {projection}
    {interactive}
    {disabled}
    {onpick}
  />
{:else}
  <div class="placeholder" role="status">
    {failed ? $t('play.map.error') : $t('play.map.loading')}
  </div>
{/if}

<style>
  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 980 / 500;
    width: 100%;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-muted);
  }
</style>
