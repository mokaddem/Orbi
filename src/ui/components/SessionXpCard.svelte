<script lang="ts">
  import { onDestroy } from 'svelte';
  import { t } from '../../i18n';
  import { RANKS, type RankProgress, type XpSource, type XpSourceKey } from '../../domain';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';
  import RankMedal from './RankMedal.svelte';

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
    startProgress = null,
    startFraction = 0,
    reduceMotion = false,
    rankedUp = false,
  }: {
    earned: number;
    breakdown: XpSource[];
    progress?: RankProgress | null;
    /**
     * The pre-run rank snapshot. When it's a *lower* rank than `progress`, the card opens on it and
     * rolls the bar over to the earned rank at the finale — the level-up animation. Same rank (or
     * absent) → a single-rank fill, exactly as before.
     */
    startProgress?: RankProgress | null;
    startFraction?: number;
    reduceMotion?: boolean;
    /** This run crossed a rank threshold — fire a celebratory burst off the (new-rank) badge. */
    rankedUp?: boolean;
  } = $props();

  // Animate only in a real browser with motion allowed. Otherwise (reduced motion, or jsdom without
  // IntersectionObserver) render the finished frame immediately — no reveal-gating, no count-up.
  const canAnimate = $derived(!reduceMotion && typeof IntersectionObserver !== 'undefined');

  // A level-up run crossed a rank threshold — we have a *lower* pre-run rank to open on. Gated on
  // canAnimate: with motion off (or in jsdom) we just show the finished frame at the earned rank.
  const rollingOver = $derived(
    canAnimate && !!startProgress && !!progress && startProgress.rank.index < progress.rank.index,
  );
  // Has the bar rolled over to the earned rank yet? Flipped once, at the finale after the tally lands.
  let rolled = $state(false);
  // The rank the head + bar currently show: the pre-run rank until the roll-over, then the earned
  // rank — a single rank otherwise (and always the final rank when not animating).
  const shownProgress = $derived(rollingOver && !rolled ? startProgress! : progress);

  const rankName = $derived(shownProgress ? $t(`rank.names.${shownProgress.rank.key}`) : '');
  const nextName = $derived(shownProgress?.next ? $t(`rank.names.${shownProgress.next.key}`) : '');
  const totalXp = $derived(shownProgress ? shownProgress.rank.minXp + shownProgress.xpIntoRank : 0);
  // aria-valuenow reports how far into the *shown* rank the player is (its true fill, not the roll).
  const valueNow = $derived(shownProgress ? Math.round(shownProgress.fraction * 100) : 0);
  // The teal "banked" base and the gold gain's target, in current-rank percent, per phase:
  //  • no level-up          → base = pre-run fill,               target = current fill
  //  • level-up, pre-roll   → base = the OLD rank's pre-run fill, target = 100% (fill it to the top)
  //  • level-up, post-roll  → base = 0,                          target = new rank's fill (from empty)
  const startPct = $derived.by(() => {
    if (!shownProgress) return 0;
    if (rollingOver) return rolled ? 0 : Math.round(startProgress!.fraction * 100);
    return Math.round(Math.max(0, Math.min(shownProgress.fraction, startFraction)) * 100);
  });
  const targetPct = $derived.by(() => {
    if (!shownProgress) return 0;
    if (rollingOver && !rolled) return 100;
    return Math.round(shownProgress.fraction * 100);
  });

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

  let cardEl = $state<HTMLDivElement>();
  let fxEl = $state<HTMLCanvasElement>();
  let totalEl = $state<HTMLElement>();
  let badgeEl = $state<HTMLElement>();
  let visible = $state(false); // ≥50% on screen — the tally may begin (after the hold)
  let fullyVisible = $state(false); // the whole card (its bottom edge) is on screen
  let displayEarned = $state(0); // counts up during the tally
  let revealed = $state(0); // how many rows have landed

  // Shown values: the animated ones while animating, the finished ones otherwise (so tests and
  // reduced-motion see the full card at once, with no dependency on effect timing).
  const shownEarned = $derived(canAnimate ? displayEarned : earned);
  const gainWidth = $derived(
    !canAnimate ? gainPct : earned > 0 ? gainPct * Math.min(1, displayEarned / earned) : 0,
  );

  // --- tally engine timings ---
  // The XP holds off for a beat after the card appears, then lands line by line — so on a long
  // Summary the "+N XP" never begins ticking up before the player has actually reached the card.
  // The exception: if the *whole* card is already on screen (its bottom edge in view), the player is
  // clearly looking at it, so we skip the hold and start right away (see the tally-start effect).
  const REVEAL_HOLD_MS = 3000; // wait, once the card is partly visible, before the first row lands
  const STEP_MS = 650; // per-row cadence (unhurried — the run's points land one at a time)
  const TWEEN_MS = 460; // count-up per row
  let timers: ReturnType<typeof setTimeout>[] = [];
  let raf = 0;

  // Reveal gate: track how much of the card is on screen — "seen" at ≥50%, "fully on screen" at
  // ~100% (its bottom edge in view). Keep observing until fully visible, so a partial→full scroll
  // (which shortcuts the hold below) is caught.
  $effect(() => {
    if (!canAnimate || fullyVisible || !cardEl) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.5) visible = true;
          if (e.intersectionRatio >= 0.99) fullyVisible = true;
        }
      },
      { threshold: [0.5, 0.99, 1] },
    );
    io.observe(cardEl);
    return () => io.disconnect();
  });

  // Start the tally once the rank snapshot has settled and the card has been seen. Hold a beat
  // first — but if the whole card is on screen, skip the hold and go now; and if it becomes fully
  // visible while the hold is still pending, cancel the hold and go immediately. Runs once.
  let played = false;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    if (!canAnimate || played || !progress || (!visible && !fullyVisible)) return;
    if (fullyVisible) {
      if (holdTimer !== undefined) clearTimeout(holdTimer);
      holdTimer = undefined;
      played = true;
      runTally();
    } else if (holdTimer === undefined) {
      holdTimer = setTimeout(() => {
        holdTimer = undefined;
        if (played) return;
        played = true;
        runTally();
      }, REVEAL_HOLD_MS);
      timers.push(holdTimer);
    }
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
    // Level-up finale: a beat after the last row lands (the pre-run rank now filled to the top),
    // roll the bar over to the earned rank — the badge/name swap and the bar resets and fills the
    // fresh rank from empty — then burst off the new badge. No text callout: the badge + rank name
    // already say which rank you reached. When we didn't open on a lower rank (`rollingOver` is
    // false — e.g. a same-rank `rankedUp` handoff) there's nothing to roll, so we just pop the badge.
    if (rollingOver || rankedUp) {
      timers.push(
        setTimeout(
          () => {
            if (rollingOver) rolled = true;
            burstFromBadge();
          },
          rows.length * STEP_MS + 120,
        ),
      );
    }
  }

  function tweenEarned(from: number, to: number, done: () => void): void {
    const t0 = performance.now();
    const frame = (now: number): void => {
      // Clamp low as well as high: a first rAF timestamp can land just before t0, which would make
      // the eased value briefly negative (a flashed "+-1 XP").
      const p = Math.max(0, Math.min(1, (now - t0) / TWEEN_MS));
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

  // Streak milestone: pop the running total and fire confetti off it. `animate` is optional-called —
  // it's absent in jsdom (no Web Animations API), where the burst path is only reached under test.
  function burstFromTotal(): void {
    totalEl?.animate?.(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
      { duration: 420, easing: 'cubic-bezier(.2,1.4,.3,1)' },
    );
    spawnBurst(totalEl, 42);
  }

  // Rank up: a bigger pop on the badge with a fuller burst.
  function burstFromBadge(): void {
    badgeEl?.animate?.(
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

  {#if shownProgress}
    <div class="rank-head">
      <span class="badge" aria-hidden="true" bind:this={badgeEl}
        ><RankMedal index={shownProgress.rank.index} size={46} /></span
      >
      <div class="rank-id">
        <span class="rank-name">{rankName}</span>
        <span class="rank-level">
          {$t('rank.level', { n: shownProgress.rank.index + 1, total: RANKS.length })}
        </span>
      </div>
      <span class="rank-xp">{$t('rank.xpTotal', { xp: totalXp.toLocaleString() })}</span>
    </div>

    <div
      class="track"
      class:rolled
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={valueNow}
      aria-label={$t('rank.title')}
    >
      <!-- Banked before this run (teal), then the gold gain this run added, growing in from it.
           On a level-up roll-over both segments transition (see `.track.rolled`), so the bar visibly
           resets and refills the fresh rank rather than snapping. -->
      <div class="seg base" style="width:{startPct}%"></div>
      <div class="seg gain" style="left:{startPct}%; width:{gainWidth}%"></div>
    </div>
    <span class="to-next">
      {#if shownProgress.next}
        {$t('rank.toNext', { xp: shownProgress.xpToNext.toLocaleString(), rank: nextName })}
      {:else}
        {$t('rank.max')}
      {/if}
    </span>
  {/if}

  <div class="earned-head">
    <span class="earned-label">{$t('rank.runBreakdown')}</span>
    <span class="earned-xp" data-testid="xp-earned" bind:this={totalEl}>
      <Icon name="sparkles" size="1em" />
      <span class="earned-amount">{$t('rank.earned', { xp: shownEarned.toLocaleString() })}</span>
    </span>
  </div>

  {#if rows.length > 0}
    <ul class="sources" class:tallying={canAnimate}>
      {#each rows as s, i (s.key)}
        <li
          class="src-row"
          class:shown={!canAnimate || i < revealed}
          class:streak={s.key === 'streakBonus'}
        >
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
    /* The gold→coral gradient shared by the gain bar segment and the "Earned this session" text,
       so the label and the bar it fills read as one thing. */
    --gain-grad: linear-gradient(90deg, var(--color-sun), var(--color-coral));
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

  /* Wrapper is just the confetti anchor now — the medal is self-contained. */
  .badge {
    flex: 0 0 auto;
    display: inline-flex;
    transform-origin: center;
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
    background: var(--gain-grad);
    border-radius: 0 999px 999px 0;
  }

  /* Level-up roll-over: once the pre-run rank has filled to the top, flipping to the earned rank
     collapses both segments (base → 0, the gold gain → the fresh rank's small fill). Transitioning
     width/left here makes that read as a deliberate reset-and-refill rather than a hard snap. */
  .track.rolled .seg {
    transition:
      width 0.5s cubic-bezier(0.25, 0.9, 0.3, 1),
      left 0.5s cubic-bezier(0.25, 0.9, 0.3, 1);
  }

  @media (prefers-reduced-motion: reduce) {
    .track.rolled .seg {
      transition: none;
    }
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

  /* "Earned this session" + the "+N XP" value take the gain-bar gradient, so they read as the same
     thing as the gold segment they describe. */
  .earned-label,
  .earned-amount {
    background: var(--gain-grad);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .earned-label {
    font-size: 0.9rem;
    font-weight: 700;
  }

  .earned-xp {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-weight: 800;
    font-size: 1.05rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    transform-origin: right center;
  }

  .earned-xp :global(.icon) {
    color: var(--color-sun);
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

  /* Streak milestones are a player *achievement*, not just another XP source — so the row gets its
     own violet treatment (a tinted pill + bolder violet text/icon), distinct from the warm
     "earned this session" line and the plain teal source rows. */
  .src-row.streak {
    background: var(--color-violet-weak);
    border-radius: 10px;
    padding: 0.22rem 0.45rem;
    margin: 0 -0.45rem;
  }

  .src-row.streak .src-ico,
  .src-row.streak .src-name,
  .src-row.streak .src-xp {
    color: var(--color-violet);
  }

  .src-row.streak .src-name,
  .src-row.streak .src-xp {
    font-weight: 800;
  }

  @media (prefers-reduced-motion: reduce) {
    .src-row {
      transition: none;
    }
  }
</style>
