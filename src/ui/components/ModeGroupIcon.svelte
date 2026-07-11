<script lang="ts">
  // Emblem glyph for a mode *family* on the category-first Play picker (Phase 35): a globe
  // (Map), a flag (Flags), a star (Capitals), a sparkle (Extra). Inline SVG — crisp on every
  // OS and it follows `currentColor`, so the parent chip sets a single colour for stroke/fill.
  export type ModeGroup = 'map' | 'flags' | 'capitals' | 'extra';
  let { group }: { group: ModeGroup } = $props();
</script>

<svg
  class="group-icon"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if group === 'map'}
    <!-- A globe: the whole world of countries. -->
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" />
  {:else if group === 'flags'}
    <!-- A flag on a pole. -->
    <path d="M6 3v18" />
    <path d="M6 4h11l-2.2 3.5L17 11H6" />
  {:else if group === 'capitals'}
    <!-- A star: the cartographic marker for a capital city. -->
    <path
      d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85z"
    />
  {:else}
    <!-- A plump four-point sparkle (Lucide "sparkles" star): the "extra" knowledge topics. -->
    <path
      d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"
      fill="currentColor"
      stroke="none"
    />
  {/if}
</svg>

<style>
  .group-icon {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
