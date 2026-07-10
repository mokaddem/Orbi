<script lang="ts">
  import Mascot from './Mascot.svelte';
  import type { MascotPose } from '../../domain';

  // A small "spot scene" (Phase 33): Orbi on a soft accent halo, gently breathing. Used to
  // warm up otherwise-blank slates (empty History/Progress/Summary) without new artwork — the
  // halo is a palette-driven radial tint and the idle motion falls back to the static pose
  // under reduced motion. Decorative throughout (the mascot is aria-hidden; the halo too).
  let {
    pose = 'sleepy',
    size = 116,
  }: {
    pose?: MascotPose;
    size?: number;
  } = $props();
</script>

<div class="scene">
  <span class="halo" aria-hidden="true"></span>
  <Mascot {pose} {size} animate="idle" />
</div>

<style>
  .scene {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  /* Soft glow behind Orbi, larger than the character so it reads as a gentle spotlight. */
  .halo {
    position: absolute;
    top: -22%;
    left: -22%;
    width: 144%;
    height: 144%;
    border-radius: 50%;
    background: radial-gradient(circle, var(--color-accent-weak) 0%, transparent 68%);
    z-index: 0;
    pointer-events: none;
  }

  .scene :global(.mascot) {
    position: relative;
    z-index: 1;
  }
</style>
