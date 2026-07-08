<script lang="ts">
  import shapeData from '../../data/generated/region-shapes.json';

  // Continent silhouette for a region, shown on the setup region cards. The paths are
  // dissolved continent outlines generated offline from the coarse 110m TopoJSON
  // (see scripts/build-data.mjs) — bundled, so there's no runtime geometry load. The
  // fill follows `currentColor`, so the silhouette tracks the card's selected/muted state.
  let { region }: { region: string } = $props();

  const shapes = shapeData.shapes as Record<string, string>;
  // Empty region value is the "World (all countries)" option.
  const d = $derived(shapes[region || 'World'] ?? '');
</script>

{#if d}
  <svg class="region-icon" viewBox={shapeData.viewBox} aria-hidden="true">
    <path {d} />
  </svg>
{/if}

<style>
  .region-icon {
    display: block;
    width: 100%;
    height: 100%;
  }

  .region-icon path {
    fill: currentColor;
  }
</style>
