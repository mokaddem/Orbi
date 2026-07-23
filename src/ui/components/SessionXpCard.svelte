<script lang="ts">
  import { onDestroy } from 'svelte';
  import { t } from '../../i18n';
  import {
    RANKS,
    rankForXp,
    type RankProgress,
    type XpSource,
    type XpSourceKey,
  } from '../../domain';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';
  import RankMedal from './RankMedal.svelte';
  import { rankMedal } from './rankMedal';

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
     * rolls the bar over to the earned rank the moment the counting XP crosses the threshold — the
     * level-up animation — then keeps filling the new rank. Same rank (or absent) → a single fill.
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

  let cardEl = $state<HTMLDivElement>();
  let fxEl = $state<HTMLCanvasElement>(); // front FX layer — over the badge (sparks, motes, confetti)
  let fxBackEl = $state<HTMLCanvasElement>(); // back FX layer — behind the badge (rays, rings, halo, flash)
  let totalEl = $state<HTMLElement>();
  let badgeEl = $state<HTMLElement>();
  let visible = $state(false); // ≥50% on screen — the tally may begin (after the hold)
  let fullyVisible = $state(false); // the whole card (its bottom edge) is on screen
  let displayEarned = $state(0); // counts up during the tally
  let revealed = $state(0); // how many rows have landed

  // Shown "+N XP" this run: the animated count while animating, the finished total otherwise (so
  // tests and reduced-motion see the full card at once, with no dependency on effect timing).
  const shownEarned = $derived(canAnimate ? displayEarned : earned);

  // --- the bar + head are driven by the LIVE running total, so a level-up happens the instant the
  //     accumulating XP crosses a threshold (not deferred to the end of the tally) ---
  // The pre-run total (XP banked before this session) and the live total as the run's XP counts in.
  const finalTotalXp = $derived(progress ? progress.rank.minXp + progress.xpIntoRank : 0);
  const startTotalXp = $derived(finalTotalXp - earned);
  const liveTotalXp = $derived(startTotalXp + shownEarned);
  const liveProgress = $derived(rankForXp(liveTotalXp));

  // Level-up beat: while ≥ 0 the count-up is paused and the bar is pinned FULL on this rank (the one
  // being completed); releasing it (-1) lets the crossed total pop through to the earned rank. Set
  // and cleared by the tally (see tweenEarned).
  let levelupHold = $state(-1);

  // The rank the head + bar show. It opens on the pre-run rank and climbs with the live total (never
  // below it), so the level-up happens the instant the total crosses a threshold. Purely derived, so
  // it's correct on the very first render — no init flash and no dependency on effect timing. During
  // a level-up beat it's pinned to the rank being completed (bar full) until the hold releases.
  const baseRankIndex = $derived(
    canAnimate ? (startProgress?.rank.index ?? liveProgress.rank.index) : liveProgress.rank.index,
  );
  const shownRankIndex = $derived(
    levelupHold >= 0 ? levelupHold : Math.max(baseRankIndex, liveProgress.rank.index),
  );

  // Fire the rank-up burst once each time the shown rank steps up (i.e. the live total crossed a
  // threshold — the level-up). Seeded on the first settle so merely opening on a rank doesn't burst.
  let celebratedIndex = $state(-1);
  $effect(() => {
    if (!progress || !canAnimate) return;
    if (celebratedIndex < 0) {
      celebratedIndex = shownRankIndex; // opening rank — no celebration
      return;
    }
    if (shownRankIndex > celebratedIndex) {
      celebratedIndex = shownRankIndex;
      celebrateRank(shownRankIndex);
    }
  });

  const shownRank = $derived(RANKS[Math.max(0, shownRankIndex)]);
  const shownNext = $derived(
    Math.max(0, shownRankIndex) + 1 < RANKS.length ? RANKS[Math.max(0, shownRankIndex) + 1] : null,
  );
  const rankName = $derived($t(`rank.names.${shownRank.key}`));
  const nextName = $derived(shownNext ? $t(`rank.names.${shownNext.key}`) : '');

  // Fill within the *shown* rank, from the live total. While the shown rank lags the live rank by a
  // frame at a crossing, `into/span` exceeds 1 and clamps to 100% — so the bar tops out the old rank,
  // then the {#key} reset drops it to the new rank's (near-empty) fill and it grows on from there.
  const fillFraction = $derived.by(() => {
    if (!shownNext) return 1; // top rank
    const span = shownNext.minXp - shownRank.minXp;
    if (span <= 0) return 1;
    return Math.max(0, Math.min(1, (liveTotalXp - shownRank.minXp) / span));
  });
  // Two segments of the shown rank's span: a static teal `base` (XP banked before this run — only in
  // the rank you started in) and the gold `gain` this run added, growing in from the base edge.
  // Widths are fractional percents driven frame-by-frame (no CSS transition), so growth is smooth.
  const fillPct = $derived(fillFraction * 100);
  const startRankIndex = $derived(startProgress?.rank.index ?? progress?.rank.index ?? 0);
  const startBankPct = $derived((startProgress?.fraction ?? startFraction ?? 0) * 100);
  const basePct = $derived(shownRankIndex === startRankIndex ? Math.min(fillPct, startBankPct) : 0);
  const gainPct = $derived(Math.max(0, fillPct - basePct));

  // The XP total + "to next" shown in the head, clamped to the shown rank's ceiling so they stay in
  // step with the bar during the one-frame roll-over (bar at 100% → total reads exactly the threshold).
  const shownTotalXp = $derived(
    Math.round(shownNext ? Math.min(liveTotalXp, shownNext.minXp) : liveTotalXp),
  );
  const shownXpToNext = $derived(
    shownNext ? Math.max(0, shownNext.minXp - Math.round(liveTotalXp)) : 0,
  );

  // --- tally engine timings ---
  // The XP holds off for a beat after the card appears, then lands line by line — so on a long
  // Summary the "+N XP" never begins ticking up before the player has actually reached the card.
  // The exception: if the *whole* card is already on screen (its bottom edge in view), the player is
  // clearly looking at it, so we skip the hold and start right away (see the tally-start effect).
  const REVEAL_HOLD_MS = 3000; // wait, once the card is partly visible, before the first row lands
  const STEP_MS = 650; // per-row cadence (unhurried — the run's points land one at a time)
  const TWEEN_MS = 460; // count-up per row
  const LEVELUP_PAUSE_MS = 600; // the beat the bar holds, full, at a level-up before it pops over
  let timers: ReturnType<typeof setTimeout>[] = [];
  let raf = 0;
  let reachedRankIndex = -1; // highest rank the counting total has reached (one beat per crossing)

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

  // Rows land one at a time, *sequentially*: the next row waits for the current one's count-up to
  // finish (plus a beat) — so a level-up pause in one row naturally delays what follows, instead of
  // the fixed upfront schedule letting a paused row overlap the next.
  function runTally(): void {
    reachedRankIndex = rankForXp(startTotalXp).rank.index; // the rank we open on
    const GAP_MS = Math.max(0, STEP_MS - TWEEN_MS); // beat between one row landing and the next
    let acc = 0;
    let k = 0;
    const runRow = (): void => {
      if (k >= rows.length) {
        // A real level-up is celebrated live, from its beat in tweenEarned. The only end-of-tally
        // burst left is the same-rank `rankedUp` handoff (nothing to cross, e.g. no pre-run snapshot
        // was supplied): pop the badge once the points have landed.
        if (rankedUp && !rollingOver)
          celebrateRank(progress ? progress.rank.index : shownRankIndex);
        return;
      }
      const row = rows[k];
      const from = acc;
      const to = acc + row.xp;
      acc = to;
      revealed = k + 1;
      k += 1;
      tweenEarned(from, to, () => {
        if (row.key === 'streakBonus') burstFromTotal();
        timers.push(setTimeout(runRow, GAP_MS));
      });
    };
    runRow();
  }

  function tweenEarned(from: number, to: number, done: () => void): void {
    let elapsedBefore = 0; // ms already counted before the current rAF run (carried across a beat)
    let runStart = 0;
    let started = false;

    const frame = (now: number): void => {
      if (!started) {
        runStart = now;
        started = true;
      }
      // Clamp low as well as high: a first rAF timestamp can land just before runStart, which would
      // make the eased value briefly negative (a flashed "+-1 XP").
      const elapsed = elapsedBefore + (now - runStart);
      const p = Math.max(0, Math.min(1, elapsed / TWEEN_MS));
      const e = 1 - Math.pow(1 - p, 3);
      displayEarned = Math.round(from + (to - from) * e);

      // Crossed into a higher rank this frame → the LEVEL-UP BEAT: pin the bar full on the rank being
      // completed and pause the count-up; after the hold, release it — the bar pops to the earned
      // rank (reset + refill) and the burst fires from the rank-step effect — then resume counting.
      const liveIdx = rankForXp(startTotalXp + displayEarned).rank.index;
      if (liveIdx > reachedRankIndex) {
        levelupHold = reachedRankIndex; // hold full on the rank we're leaving
        reachedRankIndex = liveIdx;
        elapsedBefore = elapsed; // remember how far the count-up got
        started = false;
        raf = 0;
        timers.push(
          setTimeout(() => {
            levelupHold = -1;
            raf = requestAnimationFrame(frame);
          }, LEVELUP_PAUSE_MS),
        );
        return;
      }

      if (p < 1) raf = requestAnimationFrame(frame);
      else {
        raf = 0;
        done();
      }
    };
    raf = requestAnimationFrame(frame);
  }

  // --- celebration FX engine ---------------------------------------------------------------------
  // Two canvas layers over the card: a BACK layer behind the badge (rays / rings / halo / glow) and a
  // FRONT layer over it (sparks / motes / confetti). A single particle array drives both — each
  // particle names its layer and its own draw + update. Coordinates are card-local CSS px (the ctx is
  // DPR-scaled once per burst). The rank-up celebration is per-band; the streak-milestone stays a
  // confetti burst.
  const FXC = {
    gold: '#f59e0b',
    goldHi: '#f0a91c',
    coral: '#ff6a3d',
    teal: '#0f9b96',
    tealHi: '#14b8b0',
    violet: '#7c5cf6',
    white: '#ffcf7a',
  };
  const CONFETTI = ['#f59e0b', '#ff6a3d', '#0f9b96', '#0b7e7a', '#f0a91c'];
  const eOut = (t: number) => 1 - Math.pow(1 - t, 3);

  type FxP = {
    x: number;
    y: number;
    life: number;
    decay: number;
    front: boolean;
    [k: string]: unknown;
  };
  let parts: FxP[] = [];
  let fxRaf = 0;
  let dpr = 1,
    fxW = 0,
    fxH = 0;
  let ctxFront: CanvasRenderingContext2D | null = null;
  let ctxBack: CanvasRenderingContext2D | null = null;

  // Size both layers to the card and DPR-scale them. Returns false when the canvases can't draw
  // (jsdom under test, or refs not ready) so callers no-op cleanly.
  function prepFx(): boolean {
    if (!fxEl || !fxBackEl || !cardEl) return false;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = cardEl.getBoundingClientRect();
    fxW = c.width;
    fxH = c.height;
    for (const cv of [fxEl, fxBackEl]) {
      cv.width = Math.round(fxW * dpr);
      cv.height = Math.round(fxH * dpr);
      cv.style.width = fxW + 'px';
      cv.style.height = fxH + 'px';
    }
    ctxFront = fxEl.getContext('2d');
    ctxBack = fxBackEl.getContext('2d');
    if (!ctxFront || !ctxBack) return false;
    ctxFront.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxBack.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function centerOf(el: HTMLElement | undefined): { x: number; y: number } {
    const c = cardEl!.getBoundingClientRect();
    const b = (el ?? cardEl!).getBoundingClientRect();
    return { x: b.left - c.left + b.width / 2, y: b.top - c.top + b.height / 2 };
  }

  function addP(p: Partial<FxP> & { draw: (p: FxP, g: CanvasRenderingContext2D) => void }): void {
    const q = p as FxP;
    if (q.life == null) q.life = 1;
    if (q.decay == null) q.decay = 0.02;
    if (q.front == null) q.front = true;
    if (!q.update) q.update = () => {};
    parts.push(q);
    if (!fxRaf) fxRaf = requestAnimationFrame(stepFx);
  }

  function stepFx(): void {
    if (!ctxFront || !ctxBack) {
      fxRaf = 0;
      return;
    }
    ctxFront.clearRect(0, 0, fxW, fxH);
    ctxBack.clearRect(0, 0, fxW, fxH);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= p.decay;
      if (p.life <= 0) {
        parts.splice(i, 1);
        continue;
      }
      (p.update as (p: FxP) => void)(p);
      (p.draw as (p: FxP, g: CanvasRenderingContext2D) => void)(p, p.front ? ctxFront : ctxBack);
    }
    if (parts.length) fxRaf = requestAnimationFrame(stepFx);
    else {
      fxRaf = 0;
      ctxFront.clearRect(0, 0, fxW, fxH);
      ctxBack.clearRect(0, 0, fxW, fxH);
    }
  }

  // --- draw kinds (each takes its layer's context). Tuned for Orbi's WHITE card surface: normal
  // source-over blending with saturated colours + colour-shadow halos — NOT additive glow, which
  // washes out to nothing on white. ---
  function dFlash(p: FxP, g: CanvasRenderingContext2D): void {
    const t = Math.max(0, Math.min(1, 1 - p.life));
    const r = Math.max(0.1, (p.r0 as number) + ((p.r1 as number) - (p.r0 as number)) * eOut(t));
    const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    grad.addColorStop(0, `rgba(255,176,52,${0.5 * p.life})`);
    grad.addColorStop(0.5, `rgba(240,140,20,${0.24 * p.life})`);
    grad.addColorStop(1, 'rgba(240,140,20,0)');
    g.save();
    g.fillStyle = grad;
    g.beginPath();
    g.arc(p.x, p.y, r, 0, 6.2832);
    g.fill();
    g.restore();
  }
  function dRing(p: FxP, g: CanvasRenderingContext2D): void {
    const t = Math.max(0, Math.min(1, 1 - p.life));
    const r = Math.max(0.1, (p.r0 as number) + ((p.r1 as number) - (p.r0 as number)) * eOut(t));
    g.save();
    g.globalAlpha = Math.max(0, p.life * p.life);
    g.strokeStyle = p.color as string;
    g.lineWidth = (p.w as number) * p.life + 0.8;
    g.shadowBlur = 6;
    g.shadowColor = p.color as string;
    g.beginPath();
    g.arc(p.x, p.y, r, 0, 6.2832);
    g.stroke();
    g.restore();
  }
  function dRays(p: FxP, g: CanvasRenderingContext2D): void {
    const t = 1 - p.life;
    const grow = eOut(Math.min(1, t * 1.4));
    const alpha = Math.sin(Math.PI * Math.min(1, t)) * 0.92;
    const n = p.n as number,
      len0 = p.len as number,
      half0 = p.half as number;
    g.save();
    g.translate(p.x, p.y);
    g.rotate((p.rot as number) + t * (p.spin as number));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const len = len0 * grow * (i % 2 ? 0.6 : 1);
      const half = half0 * (i % 2 ? 0.6 : 1);
      const grad = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
      grad.addColorStop(0, `rgba(240,150,20,${alpha})`);
      grad.addColorStop(1, 'rgba(240,150,20,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a - half) * len, Math.sin(a - half) * len);
      g.lineTo(Math.cos(a + half) * len, Math.sin(a + half) * len);
      g.closePath();
      g.fill();
    }
    g.restore();
  }
  function dSpark(p: FxP, g: CanvasRenderingContext2D): void {
    const s = p.size as number,
      a = p.life * (0.6 + 0.4 * Math.sin((p.t as number) * 12 + (p.seed as number)));
    g.save();
    g.globalAlpha = Math.max(0, a);
    g.translate(p.x, p.y);
    g.rotate(p.rot as number);
    g.fillStyle = p.color as string;
    g.shadowBlur = 6;
    g.shadowColor = p.color as string;
    const q = s * 0.16;
    g.beginPath();
    g.moveTo(0, -s);
    g.lineTo(q, -q);
    g.lineTo(s, 0);
    g.lineTo(q, q);
    g.lineTo(0, s);
    g.lineTo(-q, q);
    g.lineTo(-s, 0);
    g.lineTo(-q, -q);
    g.closePath();
    g.fill();
    g.restore();
  }
  function dDot(p: FxP, g: CanvasRenderingContext2D): void {
    g.save();
    g.globalAlpha = Math.max(0, p.life);
    g.fillStyle = p.color as string;
    g.shadowBlur = (p.glow as number) || 7;
    g.shadowColor = p.color as string;
    g.beginPath();
    g.arc(p.x, p.y, Math.max(0.1, p.size as number), 0, 6.2832);
    g.fill();
    g.restore();
  }
  const HALO_COLS = ['13,148,136', '124,92,246', '240,150,20']; // teal · violet · gold (saturated)
  function dHalo(p: FxP, g: CanvasRenderingContext2D): void {
    const t = 1 - p.life;
    const inOut = Math.sin(Math.PI * Math.min(1, t));
    const R = (p.r0 as number) + ((p.r1 as number) - (p.r0 as number)) * eOut(Math.min(1, t * 1.2));
    g.save();
    for (let i = 0; i < 3; i++) {
      const ang = t * 1.6 + i * 2.094;
      const ox = Math.cos(ang) * R * 0.22,
        oy = Math.sin(ang) * R * 0.22;
      const grad = g.createRadialGradient(p.x + ox, p.y + oy, 0, p.x + ox, p.y + oy, R);
      grad.addColorStop(0, `rgba(${HALO_COLS[i]},${0.42 * inOut})`);
      grad.addColorStop(1, `rgba(${HALO_COLS[i]},0)`);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(p.x + ox, p.y + oy, R, 0, 6.2832);
      g.fill();
    }
    g.restore();
  }
  function dConfetti(p: FxP, g: CanvasRenderingContext2D): void {
    g.save();
    g.globalAlpha = Math.max(0, p.life);
    g.translate(p.x, p.y);
    g.rotate(p.rot as number);
    g.fillStyle = p.color as string;
    g.fillRect(
      -(p.size as number) / 2,
      -(p.size as number) / 2,
      p.size as number,
      (p.size as number) * 0.6,
    );
    g.restore();
  }

  function badgePop(scale: number): void {
    badgeEl?.animate?.(
      [{ transform: 'scale(1)' }, { transform: `scale(${scale})` }, { transform: 'scale(1)' }],
      { duration: 620, easing: 'cubic-bezier(.2,1.5,.3,1)' },
    );
  }

  // Lower bands (bronze / silver): radiant sunburst rays flare behind the badge.
  function fxSunburst(cx: number, cy: number): void {
    addP({ x: cx, y: cy, r0: 5, r1: 66, decay: 0.06, draw: dFlash, front: false });
    addP({
      x: cx,
      y: cy,
      n: 16,
      len: 108,
      half: 0.11,
      rot: -0.3,
      spin: 0.8,
      decay: 0.02,
      draw: dRays,
      front: false,
    });
    badgePop(1.28);
  }

  // Mid bands (gold / platinum): motes rush in, the badge flashes, then it erupts in a ring of sparks.
  function fxChargeBurst(cx: number, cy: number): void {
    const N = 22,
      R = 58;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + Math.random() * 0.2;
      const col = i % 3 === 0 ? FXC.tealHi : i % 3 === 1 ? FXC.goldHi : FXC.coral;
      const sx = cx + Math.cos(a) * R,
        sy = cy + Math.sin(a) * R;
      addP({
        x: sx,
        y: sy,
        size: 2 + Math.random() * 1.4,
        color: col,
        glow: 8,
        decay: 0.032,
        draw: dDot,
        update: (p: FxP) => {
          const k = eOut(Math.min(1, (1 - p.life) / 0.78));
          p.x = sx + (cx - sx) * k;
          p.y = sy + (cy - sy) * k;
        },
      });
    }
    timers.push(
      setTimeout(() => {
        if (!ctxBack) return;
        addP({ x: cx, y: cy, r0: 4, r1: 96, decay: 0.06, draw: dFlash, front: false });
        addP({
          x: cx,
          y: cy,
          r0: 8,
          r1: 104,
          w: 3,
          color: FXC.goldHi,
          decay: 0.032,
          draw: dRing,
          front: false,
        });
        for (let j = 0; j < 26; j++) {
          const ang = Math.random() * Math.PI * 2,
            sp = 1.8 + Math.random() * 3.6;
          const col = j % 3 === 0 ? FXC.tealHi : j % 3 === 1 ? FXC.goldHi : FXC.coral;
          addP({
            x: cx,
            y: cy,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp,
            size: 4 + Math.random() * 3.5,
            color: col,
            rot: Math.random() * 6,
            seed: Math.random() * 6,
            t: 0,
            decay: 0.024 + Math.random() * 0.02,
            draw: dSpark,
            update: (p: FxP) => {
              p.t as number;
              p.t = (p.t as number) + 0.016;
              p.x += p.vx as number;
              p.y += p.vy as number;
              p.vx = (p.vx as number) * 0.955;
              p.vy = (p.vy as number) * 0.955;
              p.rot = (p.rot as number) + 0.1;
            },
          });
        }
        badgePop(1.34);
      }, 340),
    );
  }

  // Prestige band (crystal): a slow iridescent halo blooms behind the badge with drifting motes.
  function fxAurora(cx: number, cy: number): void {
    addP({ x: cx, y: cy, r0: 10, r1: 80, decay: 0.013, draw: dHalo, front: false });
    addP({ x: cx, y: cy, r0: 4, r1: 50, decay: 0.06, draw: dFlash, front: false });
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2,
        sp = 0.5 + Math.random() * 1.1;
      const col = i % 2 ? FXC.violet : FXC.tealHi;
      addP({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        size: 1.8 + Math.random() * 2.2,
        color: col,
        glow: 12,
        decay: 0.011 + Math.random() * 0.008,
        draw: dDot,
        update: (p: FxP) => {
          p.x += p.vx as number;
          p.y += p.vy as number;
          p.vx = (p.vx as number) * 0.98;
          p.vy = (p.vy as number) * 0.98;
        },
      });
    }
    badgePop(1.24);
  }

  // Rank up: pick the celebration by the earned rank's medal band — sunburst (bronze/silver) →
  // charge & burst (gold/platinum) → aurora (crystal). The badge always pops.
  function celebrateRank(rankIndex: number): void {
    if (!prepFx()) {
      badgePop(1.3); // still pop under test/jsdom where the canvas can't draw
      return;
    }
    const c = centerOf(badgeEl);
    const band = rankMedal(rankIndex).metal;
    if (band === 'crystal') fxAurora(c.x, c.y);
    else if (band === 'gold' || band === 'platinum') fxChargeBurst(c.x, c.y);
    else fxSunburst(c.x, c.y);
  }

  // Streak milestone: pop the running total and fire a confetti burst off it (unchanged in spirit).
  function burstFromTotal(): void {
    totalEl?.animate?.(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
      { duration: 420, easing: 'cubic-bezier(.2,1.4,.3,1)' },
    );
    if (!prepFx()) return;
    const c = centerOf(totalEl);
    for (let k = 0; k < 42; k++) {
      const a = Math.random() * Math.PI * 2,
        sp = 2 + Math.random() * 6;
      addP({
        x: c.x,
        y: c.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 3,
        g: 0.24,
        size: 3 + Math.random() * 4,
        color: CONFETTI[(Math.random() * CONFETTI.length) | 0],
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 0.4,
        decay: 0.012 + Math.random() * 0.02,
        draw: dConfetti,
        update: (p: FxP) => {
          p.vy = (p.vy as number) + (p.g as number);
          p.x += p.vx as number;
          p.y += p.vy as number;
          p.rot = (p.rot as number) + (p.vr as number);
        },
      });
    }
  }

  onDestroy(() => {
    timers.forEach(clearTimeout);
    if (raf) cancelAnimationFrame(raf);
    if (fxRaf) cancelAnimationFrame(fxRaf);
  });
</script>

<div class="xp-card" data-testid="session-xp-card" bind:this={cardEl}>
  <canvas class="fx-back" bind:this={fxBackEl} aria-hidden="true"></canvas>
  <canvas class="fx" bind:this={fxEl} aria-hidden="true"></canvas>

  {#if progress}
    <div class="rank-head">
      <span class="badge" aria-hidden="true" bind:this={badgeEl}
        ><RankMedal index={Math.max(0, shownRankIndex)} size={46} /></span
      >
      <div class="rank-id">
        <span class="rank-name">{rankName}</span>
        <span class="rank-level">
          {$t('rank.level', { n: Math.max(0, shownRankIndex) + 1, total: RANKS.length })}
        </span>
      </div>
      <span class="rank-xp">{$t('rank.xpTotal', { xp: shownTotalXp.toLocaleString() })}</span>
    </div>

    <div
      class="track"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={Math.round(fillPct)}
      aria-label={$t('rank.title')}
    >
      <!-- Banked before this run (teal), then the gold gain this run added, growing in from it.
           Keyed on the shown rank: when the live total crosses a threshold the segments are recreated
           for the fresh rank, so the bar tops out the old rank, resets, and refills the new one. -->
      {#key shownRankIndex}
        <div class="seg base" style="width:{basePct}%"></div>
        <div class="seg gain" style="left:{basePct}%; width:{gainPct}%"></div>
      {/key}
    </div>
    <span class="to-next">
      {#if shownNext}
        {$t('rank.toNext', { xp: shownXpToNext.toLocaleString(), rank: nextName })}
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
    /* Own stacking context so the back FX layer (z-index:-1) sits above the card fill but behind the
       content (badge, text, bar) — rays/halo read *behind* the medal, sparks/confetti in front. */
    isolation: isolate;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding: 0.9rem 1rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  /* Celebration FX overlays — sized to the card in JS on each burst; ignore input. `fx` is the front
     layer (over the badge), `fx-back` sits behind the content. */
  .fx,
  .fx-back {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .fx {
    z-index: 2;
  }
  .fx-back {
    z-index: -1;
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
     the tally (so no CSS transition), and jumps to its final value when not animating. On a level-up
     the whole track is re-keyed to the new rank, which resets the fill cleanly (no shrink-back). */
  .seg.gain {
    background: var(--gain-grad);
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
