<script lang="ts">
  import { onMount } from 'svelte';
  import {
    loadCountryFeatures,
    mapErrorCode,
    type CountryFeature,
    type MapProjection,
  } from '../../data';
  import { t } from '../../i18n';
  import WorldMap from './WorldMap.svelte';
  import MapError from './MapError.svelte';

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
    answerIso = null,
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
    /** Asked country in map-locate, for lenient grading only (never drawn). See `lenientLocatePick`. */
    answerIso?: string | null;
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
  // The short MAP-… code when the geometry load fails, else null. Drives the error card.
  let errorCode = $state<string | null>(null);
  let retrying = $state(false);
  // Set when the globe renderer chunk can't be imported (e.g. stale SW after a deploy): we quietly
  // fall back to the flat map rather than blocking play, matching the no-WebGL fallback below.
  let globeUnavailable = $state(false);

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
  const useGlobe = $derived(projection === 'globe' && webglSupported && !globeUnavailable);
  // WorldMap only renders when we're not on the globe; if the globe was requested but
  // WebGL is missing, fall its projection back to the historical default.
  const flatProjection = $derived<MapProjection>(
    projection === 'globe' ? 'naturalEarth' : projection,
  );

  let GlobeMap = $state<typeof import('./GlobeMap.svelte').default | null>(null);
  $effect(() => {
    if (useGlobe && !GlobeMap) {
      void import('./GlobeMap.svelte')
        .then((m) => (GlobeMap = m.default))
        .catch((err: unknown) => {
          console.error('[map] globe renderer import failed; falling back to the flat map', err);
          globeUnavailable = true;
        });
    }
  });

  // Load (or reload) the country geometry. On failure it records the MAP-… code and logs the raw
  // error to the console for debugging — the loader no longer caches a rejected promise, so a Retry
  // (or a later map screen) re-attempts cleanly instead of failing instantly for the whole session.
  async function loadFeatures(): Promise<void> {
    errorCode = null;
    try {
      features = await loadCountryFeatures();
    } catch (err) {
      errorCode = mapErrorCode(err);
      console.error(`[map] load failed (${errorCode})`, err);
    }
  }

  onMount(loadFeatures);

  async function retry(): Promise<void> {
    if (retrying) return;
    retrying = true;
    await loadFeatures();
    retrying = false;
  }
</script>

{#if errorCode}
  <MapError code={errorCode} {retrying} onRetry={retry} />
{:else if features}
  {#if useGlobe}
    {#if GlobeMap}
      <GlobeMap
        {features}
        {highlightIso}
        {pickedIso}
        {pickedLabel}
        {answerIso}
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
      {answerIso}
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
  <div class="placeholder" role="status">{$t('play.map.loading')}</div>
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

  /* Match the taller mobile board (see WorldMap `.map`) so the loading box doesn't jump. */
  @media (max-width: 640px) {
    .placeholder {
      aspect-ratio: 3 / 2;
    }
  }
</style>
