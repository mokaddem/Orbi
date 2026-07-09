<script lang="ts">
  import { icons, type IconName } from './icons';

  // Thin renderer for the inline icon registry (Phase 18). Supplies the shared house-style
  // wrapper — 24x24 viewBox, `currentColor` stroke, rounded caps/joins (matching ModeIcon and
  // the bundled flags: vector, not emoji, crisp on every OS, offline) — around path data copied
  // from Lucide (see icons.ts / scripts/build-icons.mjs).
  //
  // Decorative by default (`aria-hidden`); pass `label` to expose the icon as a labelled image
  // for the rare case an icon carries meaning on its own. Icons should normally sit *beside* a
  // text label, never replace it.
  let {
    name,
    size = '1.2em',
    label,
    strokeWidth = 1.9,
  }: {
    name: IconName;
    /** number → px, or any CSS length. Defaults to 1.2em so it scales with adjacent text. */
    size?: number | string;
    label?: string;
    strokeWidth?: number;
  } = $props();

  const dim = $derived(typeof size === 'number' ? `${size}px` : size);
</script>

<svg
  class="icon"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  style:width={dim}
  style:height={dim}
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  <!-- Icon markup is build-generated from Lucide (icons.ts) — static, no user input — so
       {@html} carries no XSS risk here. -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html icons[name]}
</svg>

<style>
  .icon {
    display: inline-block;
    vertical-align: -0.15em;
    flex: 0 0 auto;
  }
</style>
