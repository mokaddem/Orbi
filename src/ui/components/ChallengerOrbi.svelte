<script module lang="ts">
  // Per-instance counter so each mark's <linearGradient> / <clipPath> get unique ids (it can
  // appear more than once on a screen — the Home invite card and the offer modal). Client-only SPA,
  // so a plain counter is safe (no SSR hydration). Mirrors GrandmasterCrest.svelte / Mascot.svelte.
  let instanceCount = 0;
  function nextId(): string {
    instanceCount += 1;
    return `challenger-orbi-${instanceCount}`;
  }
</script>

<script lang="ts">
  // The Grandmaster Challenge *invite* mark (Phase 45): the second mood of our Orbi mascot. Where
  // GrandmasterCrest is the crowned Orbi — the *prize*, shown on the intro / victory bloom / run-over
  // — this is the Challenger: the same globe, game-face on, carrying an ember flame where the crown
  // will go. It's the fire you take *into* the gauntlet to earn that crown, so it fronts the pre-run
  // surfaces (the offer modal + the Home invitation card). The flame → crown rhyme is deliberate.
  //
  // Same house style as the crest (see Mascot.svelte / the bundled flags: vector, not emoji, crisp
  // on every OS, offline) and the same mid-teal Orbi body + arena palette, so the two read as one
  // character in two moods. Carries its own colours (it always sits on the dark arena ground), so it
  // is `currentColor`-independent and purely decorative (`aria-hidden`). Sized via `size` (used at
  // 52 / 58 px), scaling from the 0 0 64 64 viewBox.
  let { size = 58 }: { size?: number | string } = $props();

  const dim = $derived(typeof size === 'number' ? `${size}px` : size);
  const uid = nextId();
  const flameId = `${uid}-flame`;
  const clipId = `${uid}-clip`;
</script>

<svg
  class="challenger"
  viewBox="0 0 64 64"
  fill="none"
  style:width={dim}
  style:height={dim}
  aria-hidden="true"
>
  <defs>
    <!-- Ember flame gradient: deep ember at the base → gold at the tip (bottom-up), echoing the
         arena's ember "heat" and the crest's --gold-metal. -->
    <linearGradient id={flameId} x1="0" y1="1" x2="0.2" y2="0">
      <stop offset="0%" stop-color="#e0803f" />
      <stop offset="55%" stop-color="#f5b23c" />
      <stop offset="100%" stop-color="#ffe08a" />
    </linearGradient>
    <clipPath id={clipId}><circle cx="32" cy="43.5" r="17.5" /></clipPath>
  </defs>

  <!-- Globe body: identical to GrandmasterCrest so the two marks are unmistakably the same Orbi —
       mid-teal sphere, bright rim, soft sheen, faint graticule + a couple of land silhouettes,
       clipped to the sphere. Sits low in the viewBox to leave headroom for the flame. -->
  <circle cx="32" cy="43.5" r="17.5" fill="#17564e" stroke="#58d6c9" stroke-width="2" />
  <g clip-path={`url(#${clipId})`}>
    <circle cx="26" cy="37" r="9" fill="#ffffff" fill-opacity="0.06" />
    <path
      d="M15 43.5 Q32 50.5 49 43.5"
      fill="none"
      stroke="#58d6c9"
      stroke-opacity="0.24"
      stroke-width="1.1"
    />
    <path
      d="M32 26 Q43 43.5 32 61"
      fill="none"
      stroke="#58d6c9"
      stroke-opacity="0.18"
      stroke-width="1.1"
    />
    <path
      d="M32 26 Q21 43.5 32 61"
      fill="none"
      stroke="#58d6c9"
      stroke-opacity="0.18"
      stroke-width="1.1"
    />
    <path
      d="M19.5 51 C15.5 52 15.5 57 20 57 C24.5 57 24.5 51.5 21.5 51 Z"
      fill="#8ff0e6"
      fill-opacity="0.9"
    />
    <path
      d="M42.5 50.5 C39 50 37 54 40 57 C43 59 46 55.5 45 52.5 C44.4 50.8 43.4 50.5 42.5 50.5 Z"
      fill="#8ff0e6"
      fill-opacity="0.9"
    />
  </g>

  <!-- Orbi's game-face: inward-angled determined brows, focused bright eyes, a confident set grin,
       and a touch of the mascot's blush — resolute, but never mean. -->
  <path d="M23.8 40.2 L28.6 41.8" stroke="#eafbf8" stroke-width="1.8" stroke-linecap="round" />
  <path d="M40.2 40.2 L35.4 41.8" stroke="#eafbf8" stroke-width="1.8" stroke-linecap="round" />
  <circle cx="26.7" cy="44.6" r="2.3" fill="#eafbf8" />
  <circle cx="37.3" cy="44.6" r="2.3" fill="#eafbf8" />
  <circle cx="27.5" cy="43.8" r="0.8" fill="#fff" />
  <circle cx="38.1" cy="43.8" r="0.8" fill="#fff" />
  <path
    d="M27.5 50 Q32 52.4 36.5 50"
    fill="none"
    stroke="#eafbf8"
    stroke-width="1.9"
    stroke-linecap="round"
  />
  <circle cx="22.6" cy="48.5" r="1.9" fill="#f2a891" opacity="0.6" />
  <circle cx="41.4" cy="48.5" r="1.9" fill="#f2a891" opacity="0.6" />

  <!-- Ember flame in the crown's spot — the fire carried in to earn the crown. Two drifting sparks,
       an ember→gold outer flame, and a bright inner core. -->
  <circle cx="40" cy="16" r="1.1" fill="#ffcf6b" opacity="0.9" />
  <circle cx="24.5" cy="19" r="0.9" fill="#f5a23c" opacity="0.85" />
  <path
    d="M32 6.5 C27 13.5 26 17.7 27.8 21.6 C28.8 23.6 30.3 24.8 32 24.8 C33.7 24.8 35.2 23.6 36.2 21.6 C38 17.7 37 13.5 32 6.5 Z"
    fill={`url(#${flameId})`}
    stroke="#c9611f"
    stroke-width="0.7"
  />
  <path
    d="M32 12.3 C29.5 16 29 18.7 30.3 21 C30.8 22 31.4 22.5 32 22.5 C32.6 22.5 33.2 22 33.7 21 C35 18.7 34.5 16 32 12.3 Z"
    fill="#fff2c8"
    opacity="0.92"
  />
</svg>

<style>
  .challenger {
    display: block;
    flex: 0 0 auto;
  }
</style>
