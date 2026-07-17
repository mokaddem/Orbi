<script lang="ts">
  // Ambient embers for the Grandmaster arena (Phase 45) — a full-bleed canvas of slow rising ember
  // particles behind the HUD. Density and hue climb subtly with the run's heat `tier` (0..9,
  // gold → ember), so the arena warms as the board clears, in step with the escalating audio bed.
  //
  // Purely decorative. Under reduced motion it renders a *static* gold-glow gradient instead of the
  // canvas (no rAF, no particles) — matching the app's rule that motion is additive. The rAF loop
  // is paused while the page is hidden, and the particle count is hard-capped.
  let { tier = 0, reduceMotion = false }: { tier?: number; reduceMotion?: boolean } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);

  // Latest heat tier, read per-frame by the (long-lived) rAF loop. Kept as a plain ref updated by a
  // separate effect so a tier change doesn't tear down and restart the animation (which would reset
  // every ember). The main effect below depends only on `canvas` / `reduceMotion`.
  let tierRef = 0;
  $effect(() => {
    tierRef = tier;
  });

  // gold #e6c579 → ember #e0803f, interpolated by heat (tier / 9).
  const GOLD = [230, 197, 121] as const;
  const EMBER = [224, 128, 63] as const;

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

    interface Ember {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      age: number;
      life: number;
    }
    const MAX = 48;
    const embers: Ember[] = [];

    const spawn = (): Ember => ({
      x: Math.random() * W,
      y: H + 6,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -(0.25 + Math.random() * 0.55),
      r: 0.8 + Math.random() * 2.1,
      age: 0,
      life: 160 + Math.random() * 220,
    });

    let raf = 0;
    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      if (typeof document !== 'undefined' && document.hidden) return;

      const heat = Math.max(0, Math.min(1, tierRef / 9));
      const rr = Math.round(GOLD[0] + (EMBER[0] - GOLD[0]) * heat);
      const gg = Math.round(GOLD[1] + (EMBER[1] - GOLD[1]) * heat);
      const bb = Math.round(GOLD[2] + (EMBER[2] - GOLD[2]) * heat);

      // Spawn rate + cap both rise with heat: a calm few at tier 0, a denser rise near the top.
      const cap = Math.round(14 + heat * (MAX - 14));
      if (embers.length < cap && Math.random() < 0.16 + heat * 0.22) embers.push(spawn());

      ctx.clearRect(0, 0, W, H);
      for (let i = embers.length - 1; i >= 0; i -= 1) {
        const e = embers[i];
        e.age += 1;
        e.x += e.vx;
        e.y += e.vy;
        e.vy -= 0.0012; // gentle upward acceleration (rising heat)
        if (e.age > e.life || e.y < -8) {
          embers.splice(i, 1);
          continue;
        }
        // Fade in briefly, hold, fade out over the last third of life.
        const t = e.age / e.life;
        const alpha = (t < 0.12 ? t / 0.12 : t > 0.66 ? (1 - t) / 0.34 : 1) * 0.8;
        const grd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 3);
        grd.addColorStop(0, `rgba(${rr},${gg},${bb},${alpha})`);
        grd.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  });
</script>

{#if reduceMotion}
  <!-- Static fallback: a faint warm base glow, no motion. -->
  <div class="static-embers" aria-hidden="true"></div>
{:else}
  <canvas bind:this={canvas} class="embers" aria-hidden="true"></canvas>
{/if}

<style>
  .embers,
  .static-embers {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }

  .static-embers {
    background: radial-gradient(120% 80% at 50% 118%, rgba(230, 197, 121, 0.18), transparent 60%);
  }
</style>
