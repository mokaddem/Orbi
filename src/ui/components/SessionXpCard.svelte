<script lang="ts">
  import { onDestroy } from 'svelte';
  import { t } from '../../i18n';
  import { RANKS, type RankProgress, type XpSource, type XpSourceKey } from '../../domain';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  // Post-session Explorer-XP card (Phase 43+). The run's XP lands **line by line**: each source
  // tallies in one at a time — the running "+N XP" counts up and the gold gain segment steps the
  // bar forward — and the streak-milestone row lands last, popping the total with a confetti burst.
  // Reveal-gated: the tally only plays once the card scrolls on screen (on a long Summary it can
  // start below the fold). Presentational — the caller computes `earned`, `breakdown`, `progress`,
  // and `startFraction`. `progress` is the post-run rank snapshot (null until the async load
  // settles). Honours `reduceMotion` (in-app toggle) and the OS setting — both show the final frame
  // at once, as does any environment without IntersectionObserver (jsdom).
  let {
    earned,
    breakdown,
    progress = null,
    startFraction = 0,
    reduceMotion = false,
    rankedUp = false,
  }: {
    earned: number;
    breakdown: XpSource[];
    progress?: RankProgress | null;
    startFraction?: number;
    reduceMotion?: boolean;
    /** This run crossed a rank threshold — fire a celebratory burst off the (new-rank) badge. */
    rankedUp?: boolean;
  } = $props();

  const rankName = $derived(progress ? $t(`rank.names.${progress.rank.key}`) : '');
  const nextName = $derived(progress?.next ? $t(`rank.names.${progress.next.key}`) : '');
  const totalXp = $derived(progress ? progress.rank.minXp + progress.xpIntoRank : 0);
  const targetPct = $derived(progress ? Math.round(progress.fraction * 100) : 0);
  const startPct = $derived(
    progress ? Math.round(Math.max(0, Math.min(progress.fraction, startFraction)) * 100) : 0,
  );

  // The badge escalates with the ladder — shield for the early ranks up to a crown at the top
  // (matches RankChip / RankPanel).
  const RANK_ICONS: readonly IconName[] = [
    'shield',
    'shield',
    'award',
    'award',
    'medal',
    'medal',
    'gem',
    'gem',
    'crown',
    'crown',
  ];
  const rankIcon = $derived(progress ? (RANK_ICONS[progress.rank.index] ?? 'award') : 'award');

  const SOURCE_ICON: Record<XpSourceKey, IconName> = {
    correct: 'check',
    questions: 'target',
    sessions: 'play',
    streakBonus: 'flame',
    streak: 'calendar',
    badges: 'trophy',
  };
  // Only the sources that actually contributed (a 0-correct run drops the "correct" row; a run with
  // no streak milestone drops the streak row). Their `xp` sums to `earned`.
  const rows = $derived(breakdown.filter((s) => s.xp > 0));

  // The bar is two segments of the current rank's span: a static `base` (banked before this run,
  // teal) and the `gain` this run added (gold). The gain grows in from the base edge.
  const gainPct = $derived(Math.max(0, targetPct - startPct));

  // Animate only in a real browser with motion allowed. Otherwise (reduced-motion, or jsdom without
  // IntersectionObserver) render the finished frame immediately — no reveal-gating, no count-up.
  const canAnimate = $derived(!reduceMotion && typeof IntersectionObserver !== 'undefined');

  let cardEl = $state<HTMLDivElement>();
  let fxEl = $state<HTMLCanvasElement>();
  let totalEl = $state<HTMLElement>();
  let badgeEl = $state<HTMLElement>();
  let visible = $state(false);
  let displayEarned = $state(0); // counts up during the tally
  let revealed = $state(0); // how many rows have landed

  // Shown values: the animated ones while animating, the finished ones otherwise (so tests and
  // reduced-motion see the full card at once, with no dependency on effect timing).
  const shownEarned = $derived(canAnimate ? displayEarned : earned);
  const gainWidth = $derived(
    !canAnimate ? gainPct : earned > 0 ? gainPct * Math.min(1, displayEarned / earned) : 0,
  );

  // --- tally engine timings ---
  // The XP holds off for a beat after the card appears, then lands line by line. The hold's clock
  // starts the moment the card is *visible* (see the reveal gate), so on a long Summary the "+N XP"
  // never begins ticking up before the player has actually reached the card.
  const REVEAL_HOLD_MS = 1000; // wait after the card is visible before the first row lands
  const STEP_MS = 530; // per-row cadence (deliberately unhurried — ~2.1s for a 4-row run)
  const TWEEN_MS = 360; // count-up per row
  let timers: ReturnType<typeof setTimeout>[] = [];
  let raf = 0;

  // Reveal gate: mark the card visible once it's at least half on screen.
  $effect(() => {
    if (!canAnimate || visible || !cardEl) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) visible = true;
      },
      { threshold: 0.5 },
    );
    io.observe(cardEl);
    return () => io.disconnect();
  });

  // Once visible and the rank snapshot has settled, hold a beat, then run the tally once.
  let played = false;
  $effect(() => {
    if (!canAnimate || played || !visible || !progress) return;
    played = true;
    timers.push(setTimeout(runTally, REVEAL_HOLD_MS));
  });

  function runTally(): void {
    let acc = 0;
    rows.forEach((row, k) => {
      const from = acc;
      const to = acc + row.xp;
      acc = to;
      timers.push(
        setTimeout(() => {
          revealed = k + 1;
          tweenEarned(from, to, () => {
            if (row.key === 'streakBonus') burstFromTotal();
          });
        }, k * STEP_MS),
      );
    });
    // Level-up finale: a beat after the last row lands, pop the (already-updated) rank badge and
    // burst off it. No text callout — the badge + rank name already say which rank you reached.
    if (rankedUp) {
      timers.push(setTimeout(burstFromBadge, rows.length * STEP_MS + 120));
    }
  }

  function tweenEarned(from: number, to: number, done: () => void): void {
    const t0 = performance.now();
    const frame = (now: number): void => {
      const p = Math.min(1, (now - t0) / TWEEN_MS);
      const e = 1 - Math.pow(1 - p, 3);
      displayEarned = Math.round(from + (to - from) * e);
      if (p < 1) raf = requestAnimationFrame(frame);
      else {
        raf = 0;
        done();
      }
    };
    raf = requestAnimationFrame(frame);
  }

  // --- confetti: a gold burst fired from the "earned this session" total on the streak row ---
  const GOLD = ['#ff9e0b', '#ffb020', '#ff7a59', '#10a5a0', '#0b7e7a'];
  type P = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    g: number;
    life: number;
    decay: number;
    size: number;
    rot: number;
    vr: number;
    color: string;
  };
  let particles: P[] = [];
  let fxRaf = 0;
  let dpr = 1;

  // Spawn a confetti burst radiating from the centre of `el` (in card-local coordinates).
  function spawnBurst(el: HTMLElement | undefined, count: number): void {
    if (!fxEl || !cardEl || !el) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = cardEl.getBoundingClientRect();
    fxEl.width = c.width * dpr;
    fxEl.height = c.height * dpr;
    fxEl.style.width = c.width + 'px';
    fxEl.style.height = c.height + 'px';
    const b = el.getBoundingClientRect();
    const cx = (b.left - c.left + b.width / 2) * dpr;
    const cy = (b.top - c.top + b.height / 2) * dpr;
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 6;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp * dpr,
        vy: (Math.sin(a) * sp - 3) * dpr,
        g: 0.24 * dpr,
        life: 1,
        decay: 0.012 + Math.random() * 0.02,
        size: (3 + Math.random() * 4) * dpr,
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 0.4,
        color: GOLD[(Math.random() * GOLD.length) | 0],
      });
    }
    if (!fxRaf) fxRaf = requestAnimationFrame(stepFx);
  }

  // Streak milestone: pop the running total and fire confetti off it.
  function burstFromTotal(): void {
    totalEl?.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
      { duration: 420, easing: 'cubic-bezier(.2,1.4,.3,1)' },
    );
    spawnBurst(totalEl, 42);
  }

  // Rank up: a bigger pop on the badge with a fuller burst.
  function burstFromBadge(): void {
    badgeEl?.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
      { duration: 600, easing: 'cubic-bezier(.2,1.4,.3,1)' },
    );
    spawnBurst(badgeEl, 54);
  }

  function stepFx(): void {
    if (!fxEl) return;
    const ctx = fxEl.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, fxEl.width, fxEl.height);
    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (particles.length) fxRaf = requestAnimationFrame(stepFx);
    else {
      fxRaf = 0;
      ctx.clearRect(0, 0, fxEl.width, fxEl.height);
    }
  }

  onDestroy(() => {
    timers.forEach(clearTimeout);
    if (raf) cancelAnimationFrame(raf);
    if (fxRaf) cancelAnimationFrame(fxRaf);
  });
</script>

<div class="xp-card" data-testid="session-xp-card" bind:this={cardEl}>
  <canvas class="fx" bind:this={fxEl} aria-hidden="true"></canvas>

  {#if progress}
    <div class="rank-head">
      <span class="badge" aria-hidden="true" bind:this={badgeEl}
        ><Icon name={rankIcon} size={22} /></span
      >
      <div class="rank-id">
        <span class="rank-name">{rankName}</span>
        <span class="rank-level">
          {$t('rank.level', { n: progress.rank.index + 1, total: RANKS.length })}
        </span>
      </div>
      <span class="rank-xp">{$t('rank.xpTotal', { xp: totalXp.toLocaleString() })}</span>
    </div>

    <div
      class="track"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={targetPct}
      aria-label={$t('rank.title')}
    >
      <!-- Banked before this run (teal), then the gold gain this run added, growing in from it. -->
      <div class="seg base" style="width:{startPct}%"></div>
      <div class="seg gain" style="left:{startPct}%; width:{gainWidth}%"></div>
    </div>
    <span class="to-next">
      {#if progress.next}
        {$t('rank.toNext', { xp: progress.xpToNext.toLocaleString(), rank: nextName })}
      {:else}
        {$t('rank.max')}
      {/if}
    </span>
  {/if}

  <div class="earned-head">
    <span class="earned-label">{$t('rank.runBreakdown')}</span>
    <span class="earned-xp" data-testid="xp-earned" bind:this={totalEl}>
      <Icon name="sparkles" size="1em" />
      {$t('rank.earned', { xp: shownEarned.toLocaleString() })}
    </span>
  </div>

  {#if rows.length > 0}
    <ul class="sources" class:tallying={canAnimate}>
      {#each rows as s, i (s.key)}
        <li class="src-row" class:shown={!canAnimate || i < revealed}>
          <span class="src-ico" aria-hidden="true"
            ><Icon name={SOURCE_ICON[s.key]} size={15} /></span
          >
          <span class="src-label">
            <span class="src-name"
              >{s.key === 'sessions' ? $t('rank.sessionBonus') : $t(`rank.source.${s.key}`)}</span
            >
            {#if s.key !== 'sessions'}
              <span class="src-count">{s.count.toLocaleString()}</span>
            {/if}
          </span>
          <span class="src-xp">{$t('rank.earned', { xp: s.xp.toLocaleString() })}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .xp-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding: 0.9rem 1rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  /* Confetti overlay — sized to the card in JS on each burst; sits above the content, ignores input. */
  .fx {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2;
  }

  .rank-head {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .badge {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 999px;
    background: var(--color-accent-weak);
    color: var(--color-accent-strong);
    border: 2px solid var(--color-accent);
  }

  .rank-id {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1 1 auto;
  }

  .rank-name {
    font-weight: 800;
    font-size: 1.05rem;
    line-height: 1.15;
  }

  .rank-level {
    font-size: 0.78rem;
    color: var(--color-muted);
  }

  .rank-xp {
    flex: 0 0 auto;
    font-weight: 800;
    color: var(--color-accent);
    font-variant-numeric: tabular-nums;
    font-size: 0.95rem;
  }

  .track {
    position: relative;
    height: 0.7rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    overflow: hidden;
  }

  .seg {
    position: absolute;
    top: 0;
    height: 100%;
  }

  /* What the player had banked in this rank before the run. */
  .seg.base {
    left: 0;
    background: linear-gradient(90deg, var(--color-accent), var(--color-accent-strong));
    border-radius: 999px 0 0 999px;
  }

  /* This session's contribution — a distinct gold segment. Width is driven frame-by-frame during
     the tally (so no CSS transition), and jumps to its final value when not animating. */
  .seg.gain {
    background: linear-gradient(90deg, var(--color-sun), var(--color-coral));
    border-radius: 0 999px 999px 0;
  }

  .to-next {
    font-size: 0.8rem;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  .earned-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.6rem;
    margin-top: 0.15rem;
    padding-top: 0.55rem;
    border-top: 1px solid var(--color-border);
  }

  .earned-label {
    font-size: 0.9rem;
    color: var(--color-muted);
    font-weight: 600;
  }

  .earned-xp {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-weight: 800;
    font-size: 1.05rem;
    color: var(--color-accent-strong);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    transform-origin: right center;
  }

  .earned-xp :global(.icon) {
    color: var(--color-accent);
  }

  .sources {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .src-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    transition:
      opacity 0.3s ease,
      transform 0.3s ease;
  }

  /* While the tally is playing, rows that haven't landed yet are hidden; each reveals as it lands.
     Outside the tally (reduced motion / no IntersectionObserver) rows are simply visible. */
  .sources.tallying .src-row:not(.shown) {
    opacity: 0;
    transform: translateY(4px);
  }

  .src-ico {
    flex: 0 0 auto;
    display: inline-flex;
    color: var(--color-accent);
  }

  .src-label {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    flex: 1 1 auto;
    min-width: 0;
  }

  .src-name {
    font-size: 0.88rem;
    font-weight: 600;
  }

  .src-count {
    font-size: 0.76rem;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  .src-xp {
    flex: 0 0 auto;
    font-weight: 700;
    font-size: 0.84rem;
    color: var(--color-accent-strong);
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-reduced-motion: reduce) {
    .src-row {
      transition: none;
    }
  }
</style>
