<script lang="ts">
  import Mascot from './Mascot.svelte';
  import type { MascotPose } from '../../domain';

  // A page heading anchored by Orbi (Phase 33): a small idle mascot beside the title, so the
  // main routes carry the character the way Home's hero does. Decorative — the <h1> still
  // carries the heading for assistive tech. Idle motion falls back to the static pose under
  // reduced motion (see Mascot).
  let {
    title,
    pose = 'wave',
    size = 60,
  }: {
    title: string;
    pose?: MascotPose;
    size?: number;
  } = $props();
</script>

<div class="page-hero">
  <Mascot {pose} {size} animate="idle" />
  <h1>{title}</h1>
</div>

<style>
  .page-hero {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .page-hero h1 {
    margin: 0;
  }
</style>
