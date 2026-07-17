<script lang="ts">
  import type { ProjectedCountry } from './atlas-map';

  // A small region-framed locator for the review study card (Phase 48). Given a region's
  // pre-projected member paths (from `projectRegion`) and the focus country's ISO, it draws that
  // region zoomed to fill the tile with the focus country picked out in coral — so a country reads
  // clearly against its neighbours, unlike a speck on a whole-world thumbnail. The projection is
  // computed once per region by the caller and shared across every card, so this stays a dumb SVG.
  let {
    projected,
    focusIso,
    width = 320,
    height = 240,
    label = '',
  }: {
    projected: ProjectedCountry[];
    focusIso: string;
    width?: number;
    height?: number;
    label?: string;
  } = $props();
</script>

<div class="loc">
  <svg
    viewBox="0 0 {width} {height}"
    role="img"
    aria-label={label}
    preserveAspectRatio="xMidYMid meet"
  >
    {#each projected as c (c.iso2)}
      <path d={c.d} class="c" class:focus={c.iso2 === focusIso} />
    {/each}
  </svg>
</div>

<style>
  .loc {
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

  /* Region members: quiet land, so the focus country reads as the figure on top. */
  .c {
    fill: var(--map-land);
    stroke: var(--map-border);
    stroke-width: 0.5;
    stroke-linejoin: round;
  }

  /* The country being revised: the bold coral shape (same treatment as the Atlas locator). */
  .c.focus {
    fill: var(--color-coral);
    stroke: var(--map-highlight-line);
    stroke-width: 1.2;
    paint-order: stroke;
  }
</style>
