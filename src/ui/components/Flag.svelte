<script lang="ts">
  import { flagUrl } from '../../data';
  import type { Country } from '../../data';

  // Renders a country's bundled SVG flag. `alt` defaults to empty so the flag is
  // decorative: in play, the flag is the *prompt* (flag-to-country) or an *option*
  // to identify (country-to-flag), and a descriptive alt would give the answer away.
  // Callers pass an explicit `alt` only where naming the country is intended (reveal,
  // summary, missed list).
  let { country, alt = '' }: { country: Country; alt?: string } = $props();
</script>

<img class="flag" src={flagUrl(country)} {alt} loading="lazy" draggable="false" />

<style>
  .flag {
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: contain;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
  }
</style>
