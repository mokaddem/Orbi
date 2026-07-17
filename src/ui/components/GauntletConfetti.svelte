<script lang="ts">
  // Victory confetti for the Grandmaster bloom (Phase 45 ④) — a full-bleed canvas of gold/teal
  // strips falling with gravity + spin, behind the crest/title. A steady light fall (not one burst)
  // so the celebration stays alive while the player reads the screen, capped and paused when hidden.
  //
  // Purely decorative and motion-only: under reduced motion the parent simply does not mount it (no
  // static fallback — confetti has no meaningful still form), matching the arena's other bursts.
  let { reduceMotion = false }: { reduceMotion?: boolean } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);

  // Gold, teal, and a pale cream — the arena's celebratory palette.
  const COLORS = ['#e6c579', '#45c9bd', '#f2e4bf', '#10a5a0', '#ffe083'] as const;

  $effect(() => {
    if (reduceMotion || !canvas) return;
    const cv = canvas;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const DPR = Math.min(2, window.devicePixelRatio || 1);
    let W = 1;
    let H = 1;
    const resize = (): void => {
      const r = cv.getBoundingClientRect();
      W = Math.max(1, Math.floor(r.width));
      H = Math.max(1, Math.floor(r.height));
      cv.width = Math.floor(W * DPR);
      cv.height = Math.floor(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(cv);

    interface Bit {
      x: number;
      y: number;
      vx: number;
      vy: number;
      w: number;
      h: number;
      rot: number;
      vr: number;
      color: string;
    }
    const MAX = 90;
    const bits: Bit[] = [];

    const spawn = (seed = false): Bit => ({
      x: Math.random() * W,
      // Seed the first fall spread across the height; later spawns drop in from just above the top.
      y: seed ? Math.random() * H : -12,
      vx: (Math.random() - 0.5) * 0.8,
      vy: 1.1 + Math.random() * 1.6,
      w: 4 + Math.random() * 5,
      h: 7 + Math.random() * 7,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.24,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
    for (let i = 0; i < 64; i += 1) bits.push(spawn(true));

    let raf = 0;
    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      if (typeof document !== 'undefined' && document.hidden) return;

      if (bits.length < MAX && Math.random() < 0.5) bits.push(spawn());

      ctx.clearRect(0, 0, W, H);
      for (let i = bits.length - 1; i >= 0; i -= 1) {
        const b = bits[i];
        b.x += b.vx;
        b.y += b.vy;
        b.vy += 0.012; // gravity
        b.rot += b.vr;
        if (b.y > H + 14) {
          bits.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.fillStyle = b.color;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  });
</script>

{#if !reduceMotion}
  <canvas bind:this={canvas} class="confetti" aria-hidden="true"></canvas>
{/if}

<style>
  .confetti {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2;
  }
</style>
