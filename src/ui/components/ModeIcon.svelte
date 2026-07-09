<script lang="ts">
  import type { GameMode } from '../../domain';

  // Simple inline-SVG line glyph for each game mode, shown on the setup mode cards.
  // Inline SVG (not emoji) keeps it crisp and identical on every OS — the same
  // rationale the project uses for bundled flag SVGs. Strokes inherit `currentColor`
  // so the glyph follows the card's text/selected colour.
  let { mode }: { mode: GameMode } = $props();
</script>

<svg
  class="mode-icon"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if mode === 'flag-to-country'}
    <!-- A flag on a pole: the prompt is a flag. -->
    <path d="M6 3v18" />
    <path d="M6 4h11l-2.2 3.5L17 11H6" />
  {:else if mode === 'country-to-flag'}
    <!-- A label card with text lines: the prompt is a country name. -->
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
    <path d="M6.5 10h11M6.5 14h7" />
  {:else if mode === 'map-highlight'}
    <!-- A location pin dropped on a place: you're shown which country. -->
    <path d="M12 21c4.5-4.2 6.5-7.2 6.5-10.5a6.5 6.5 0 0 0-13 0C5.5 13.8 7.5 16.8 12 21Z" />
    <circle cx="12" cy="10.5" r="2.3" />
  {:else if mode === 'capital-to-country'}
    <!-- A star: the cartographic marker for a capital city — the prompt is a capital. -->
    <path
      d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85z"
    />
  {:else if mode === 'country-to-capital'}
    <!-- A classical government building: the answer is the country's capital city. -->
    <path d="M12 3.5 3.5 8h17z" />
    <path d="M6 8v9M12 8v9M18 8v9" />
    <path d="M3.5 17.5h17M3 20.5h18" />
  {:else}
    <!-- A crosshair / target: you must find the place yourself (locate). -->
    <circle cx="12" cy="12" r="7" />
    <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
    <circle cx="12" cy="12" r="1.6" />
  {/if}
</svg>

<style>
  .mode-icon {
    display: block;
    width: 1.5rem;
    height: 1.5rem;
    flex: 0 0 auto;
  }
</style>
