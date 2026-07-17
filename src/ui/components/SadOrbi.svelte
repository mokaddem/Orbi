<script module lang="ts">
  // Per-instance counter so each mark's <clipPath> gets a unique id (multiple can appear on one
  // screen). Client-only SPA, so a plain counter is safe (no SSR hydration). Mirrors
  // GrandmasterCrest.svelte / ChallengerOrbi.svelte / Mascot.svelte.
  let instanceCount = 0;
  function nextId(): string {
    instanceCount += 1;
    return `sad-orbi-${instanceCount}`;
  }
</script>

<script lang="ts">
  // The Grandmaster Challenge *loss* mark (Phase 45): the third mood of our Orbi mascot. A run
  // branches on its outcome — a clean sweep blooms the crowned GrandmasterCrest (the prize), while a
  // fatal miss or a forfeit ends in the somber run-over. This is the face for that screen: the same
  // mid-teal globe, uncrowned and crestfallen — worried brows, a downcast gaze, a single tear, a
  // gentle frown. Warm, never mocking (Orbi never gloats over a loss); the sadness lives in the face,
  // so the run-over shows it at near-full strength rather than a ghosted crown.
  //
  // Same house style + palette as the crest / challenger, so the three read as one character in
  // three moods. Carries its own colours (it always sits on the dark arena ground), so it is
  // `currentColor`-independent and purely decorative (`aria-hidden`). Sized via `size` (used at
  // 92 px on the run-over), scaling from the 0 0 64 64 viewBox.
  let { size = 92 }: { size?: number | string } = $props();

  const dim = $derived(typeof size === 'number' ? `${size}px` : size);
  const uid = nextId();
  const clipId = `${uid}-clip`;
</script>

<svg
  class="sad"
  viewBox="0 0 64 64"
  fill="none"
  style:width={dim}
  style:height={dim}
  aria-hidden="true"
>
  <defs>
    <clipPath id={clipId}><circle cx="32" cy="43.5" r="17.5" /></clipPath>
  </defs>

  <!-- Globe body: identical to the crest / challenger so all three are unmistakably the same Orbi —
       mid-teal sphere, bright rim, soft sheen, faint graticule + a couple of land silhouettes,
       clipped to the sphere. -->
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

  <!-- Crestfallen face: worried brows (inner ends high — a gentle tent), an open downcast gaze, a
       single falling tear, and a soft frown. A faint blush keeps it warm rather than grim. -->
  <path
    d="M24 42 Q26.3 40.4 28.7 40.7"
    fill="none"
    stroke="#eafbf8"
    stroke-width="1.7"
    stroke-linecap="round"
  />
  <path
    d="M40 42 Q37.7 40.4 35.3 40.7"
    fill="none"
    stroke="#eafbf8"
    stroke-width="1.7"
    stroke-linecap="round"
  />
  <circle cx="26.7" cy="45" r="2.2" fill="#eafbf8" />
  <circle cx="37.3" cy="45" r="2.2" fill="#eafbf8" />
  <circle cx="27.4" cy="44.3" r="0.7" fill="#fff" />
  <circle cx="38" cy="44.3" r="0.7" fill="#fff" />
  <path
    d="M25 47.6 C23.7 49.4 23.7 51 25 51 C26.3 51 26.3 49.4 25 47.6 Z"
    fill="#a9defd"
    opacity="0.92"
  />
  <path
    d="M28 51.4 Q32 48.9 36 51.4"
    fill="none"
    stroke="#eafbf8"
    stroke-width="1.8"
    stroke-linecap="round"
  />
  <circle cx="22.6" cy="48.8" r="1.8" fill="#f2a891" opacity="0.5" />
  <circle cx="41.4" cy="48.8" r="1.8" fill="#f2a891" opacity="0.5" />
</svg>

<style>
  .sad {
    display: block;
    flex: 0 0 auto;
  }
</style>
