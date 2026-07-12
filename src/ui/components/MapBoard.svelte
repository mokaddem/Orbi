<script lang="ts">
  import { onMount } from 'svelte';
  import { loadCountryFeatures, type CountryFeature, type MapProjection } from '../../data';
  import { t } from '../../i18n';
  import WorldMap from './WorldMap.svelte';

  // Async wrapper around the map renderers: it fetches + decodes the bundled TopoJSON on
  // mount (memoized in the data layer, so it runs at most once per session) and shows a
  // loading / error state until ready. Play lazy-imports *this* component, which keeps
  // d3-geo and the geometry chunk out of the bundle for flag-only sessions.
  //
  // The projection preference selects the renderer: the four planar projections draw with
  // the SVG `WorldMap`; `'globe'` (Phase 38) draws with the WebGL `GlobeMap`, which is
  // *lazy-imported here* so three.js only enters the bundle when the globe is actually
  // used. If the device has no WebGL, the globe silently falls back to the flat Natural
  // Earth map so play is never broken.
  let {
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
    highlightIso?: string | null;
    pickedIso?: string | null;
    pickedLabel?: string | null;
    revealIso?: string | null;
    revealLabel?: string | null;
    focusIsos?: string[] | null;
    projection?: MapProjection;
    interactive?: boolean;
    disabled?: boolean;
    reduceMotion?: boolean;
    questionKey?: string | number | null;
    onpick?: (iso2: string) => void;
  } = $props();

  let features = $state<Map<string, CountryFeature> | null>(null);
  let failed = $state(false);

  function detectWebGL(): boolean {
    try {
      const c = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (c.getContext('webgl') || c.getContext('experimental-webgl'))
      );
    } catch {
      return false;
    }
  }

  const webglSupported = detectWebGL();
  const useGlobe = $derived(projection === 'globe' && webglSupported);
  // WorldMap only renders when we're not on the globe; if the globe was requested but
  // WebGL is missing, fall its projection back to the historical default.
  const flatProjection = $derived<MapProjection>(
    projection === 'globe' ? 'naturalEarth' : projection,
  );

  let GlobeMap = $state<typeof import('./GlobeMap.svelte').default | null>(null);
  $effect(() => {
    if (useGlobe && !GlobeMap) {
      void import('./GlobeMap.svelte').then((m) => (GlobeMap = m.default));
    }
  });

  onMount(async () => {
    try {
      features = await loadCountryFeatures();
    } catch {
      failed = true;
    }
  });
</script>

{#if features}
  {#if useGlobe}
    {#if GlobeMap}
      <GlobeMap
        {features}
        {highlightIso}
        {pickedIso}
        {pickedLabel}
        {revealIso}
        {revealLabel}
        {focusIsos}
        {interactive}
        {disabled}
        {reduceMotion}
        {questionKey}
        {onpick}
      />
    {:else}
      <div class="placeholder" role="status">{$t('play.map.loading')}</div>
    {/if}
  {:else}
    <WorldMap
      {features}
      {highlightIso}
      {pickedIso}
      {pickedLabel}
      {revealIso}
      {revealLabel}
      {focusIsos}
      projection={flatProjection}
      {interactive}
      {disabled}
      {reduceMotion}
      {questionKey}
      {onpick}
    />
  {/if}
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
