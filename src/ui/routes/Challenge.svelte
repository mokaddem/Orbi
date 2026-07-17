<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { push } from 'svelte-spa-router';
  import { t, localizedName, localizedText, localizedRegion } from '../../i18n';
  import { isMapMode, filterCountries, type GameMode } from '../../domain';
  import { getCountries, getCountry, type Country } from '../../data';
  import { challenge, pendingChallenge, justCertified } from '../stores/challenge';
  import { prefs, recordChallengeResult } from '../stores/persistence';
  import { sound } from '../sound';
  import { bedTierFor } from '../sound.bed';
  import Flag from '../components/Flag.svelte';
  import ChoiceGrid from '../components/ChoiceGrid.svelte';
  import ChallengeSearchList from '../components/ChallengeSearchList.svelte';
  import GauntletEmbers from '../components/GauntletEmbers.svelte';
  import GauntletConfetti from '../components/GauntletConfetti.svelte';
  import GrandmasterCrest from '../components/GrandmasterCrest.svelte';

  // The Grandmaster Run Play shell (Phase 44/45). Drives the dedicated one-life `challenge` store —
  // deliberately separate from `Play.svelte` / `QuizSession`, since a run interleaves both of a
  // family's directions, holds the whole continent as fixed options (no 4-choice crutch), and ends
  // on the first miss. A run is a *standalone test* of already-mastered material: on finish it writes
  // ONLY to the dedicated `grandmaster` store (certification + daily cooldown) — never a
  // `SessionRecord` — so it grants **no XP**, feeds no History stats, and does not touch the
  // play-streak (Phase 45). It also never writes spaced-repetition: a single fatal slip must not
  // demote the mastery that unlocked the run.

  // A correct answer flashes briefly then advances; a miss (fatal — the run is over) lingers on the
  // reveal before the fail Summary. Fixed by design, matching Play's dwell feel.
  const CORRECT_MS = 1200;
  const REVEAL_MS = 3200;
  const dwellMs = (correct: boolean): number => (correct ? CORRECT_MS : REVEAL_MS);

  // Audio (Phase 44 — the Grandmaster Challenge score, see docs/gauntlet-audio-spec.md). "Enter the
  // Arena" fires as the arena mounts, paired 1:1 with the cinematic entry transition below (or, under
  // reduce-motion, audio-only); the looping bed swells in a beat later. Tunable in-app.
  const BED_START_DELAY_MS = 950;
  let bedStartTimer: ReturnType<typeof setTimeout> | null = null;

  // Cinematic entry (Phase 45 ③): on Accept the arena mounts on a dim ground, the ceremonial title
  // blooms (gm-titlein), then the HUD crossfades in — paired with the `enter` cue. A three-beat
  // state ('intro' → 'leaving' → 'live'): 'leaving' crossfades the intro overlay out while the HUD
  // fades in over the same ground, then 'live' unmounts the overlay. Skipped under reduce-motion
  // (starts 'live'; the cue still plays, there's just no visual) and on a resumed mid-run run.
  const INTRO_HOLD_MS = 1900; // the title bloom hold — matches gm-titlein
  const INTRO_FADE_MS = 600; // the overlay-out / HUD-in crossfade — matches gm-hudin ("HUD fades in")
  let introPhase = $state<'intro' | 'leaving' | 'live'>('live');
  let introHoldTimer: ReturnType<typeof setTimeout> | null = null;
  let introFadeTimer: ReturnType<typeof setTimeout> | null = null;

  // The in-arena end screen (Phase 45 ④): a finished run reveals a victory golden-bloom (clean
  // sweep) or a runover (the fatal miss) right here — it never routes to the generic /summary. Holds
  // the finished rollup the overlay renders from, so it's independent of the (now-cleared) run state.
  let ended = $state<{
    passed: boolean;
    cleared: number;
    total: number;
    missed: Country | null;
  } | null>(null);
  // The last bed intensity tier seen, so a tier-up (a crossed N/10 boundary) triggers the Surge
  // once. `-1` = uninitialized: the first observation just syncs the bed (no Surge), which also
  // keeps a resumed mid-run run from firing a spurious Surge. Per component instance.
  let lastBedTier = -1;

  // ---- Arena visuals (Phase 45) ---------------------------------------------------------------
  // Respect both the in-app "reduce animation" pref and the OS setting (matches how Play.svelte
  // gates its StreakBurst). The embers canvas is skipped and the CSS animations collapse to instant.
  const reducedMotionQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  const reduceMotion = $derived($prefs.reduceMotion || (reducedMotionQuery?.matches ?? false));

  // The run's heat tier (0..9) — the SAME `bedTierFor` mapping the audio bed uses — so the sidebar's
  // lit notches and the ember / vignette warmth climb in lockstep with the escalating bed.
  const heatTier = $derived(
    bedTierFor($challenge.state?.cleared ?? 0, $challenge.state?.total ?? 0),
  );
  // Nine notch boundaries, one per N/10 of the run (the tiers 1..9; tier 0 is the empty base).
  const NOTCHES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
  // The just-crossed boundary flashes its notch white. The tier only ever climbs (0 → 9), so this is
  // a strictly-increasing value — the template keys the one-shot pop on it, remounting (replaying
  // `gm-notch-flash`) on each new tier. A plain assignment (no self-read), so it can't loop the effect.
  let flashedTier = $state(0);
  // The fatal miss shakes the arena and throws a one-shot white flash (both neutralized by the
  // arena's reduce-motion guard). A run ends on its one miss, so neither needs resetting — plain
  // writes, so the verdict effect never reads-and-writes its own state.
  let shaking = $state(false);
  let missed = $state(false);

  // The country's flag anchors the prompt for country-to-capital (the answer is the capital, so the
  // flag is a study aid, not the answer). Its flag is shown beside the reveal for the map/capital
  // modes (where the flag wasn't the question) once answered.
  const PROMPT_FLAG_MODES: GameMode[] = ['country-to-capital'];
  const REVEAL_FLAG_MODES: GameMode[] = [
    'map-highlight',
    'map-locate',
    'capital-to-country',
    'country-to-capital',
  ];

  // The map board is a heavy lazy chunk (d3-geo + TopoJSON) — pulled in only for the Map family.
  let MapBoard = $state<typeof import('../components/MapBoard.svelte').default | null>(null);
  let mapFailed = $state(false);
  $effect(() => {
    if ($challenge.config?.family === 'map' && !MapBoard && !mapFailed) {
      import('../components/MapBoard.svelte')
        .then((m) => (MapBoard = m.default))
        .catch(() => (mapFailed = true));
    }
  });

  // The continent's ISO codes to frame the map on — memoized by region so the projection is
  // computed once per run, not per question.
  let focusRegion: string | null = null;
  let focusIsos: string[] | null = null;
  function continentIsos(region: string): string[] {
    if (region !== focusRegion) {
      focusRegion = region;
      focusIsos = filterCountries(getCountries(), { region }).map((c) => c.iso2);
    }
    return focusIsos ?? [];
  }

  // Launch the staged run (from the Progress "prove it" entry). With nothing staged and no run in
  // flight, there's nothing to play — send the player back to where runs are launched.
  onMount(() => {
    const pending = get(pendingChallenge);
    if (pending) {
      pendingChallenge.set(null);
      challenge.start(pending);
      // Enter the Arena — paired with the title bloom (below); then swell the bed in after a beat.
      sound.play('enter');
      if (!reduceMotion) {
        // Run the intro: hold the bloom, then crossfade the overlay out / the HUD in.
        introPhase = 'intro';
        introHoldTimer = setTimeout(() => {
          introHoldTimer = null;
          introPhase = 'leaving';
          introFadeTimer = setTimeout(() => {
            introFadeTimer = null;
            introPhase = 'live';
          }, INTRO_FADE_MS);
        }, INTRO_HOLD_MS);
      }
      bedStartTimer = setTimeout(() => {
        bedStartTimer = null;
        sound.startBed();
      }, BED_START_DELAY_MS);
    } else {
      const view = get(challenge);
      if (view.status === 'idle' || view.status === 'finished') {
        challenge.reset();
        push('/progress');
      } else if (view.state) {
        // Resuming an in-flight run (navigated back mid-run): restore the bed at its current tier
        // (no Enter cue, and no tier-0 dropout on re-entry).
        sound.startBed(bedTierFor(view.state.cleared, view.state.total));
      }
    }
    // The bed must never outlive the route; quit/finalize handle the normal stops, this is the net.
    return () => {
      if (bedStartTimer !== null) clearTimeout(bedStartTimer);
      if (introHoldTimer !== null) clearTimeout(introHoldTimer);
      if (introFadeTimer !== null) clearTimeout(introFadeTimer);
      sound.stopBed(0);
    };
  });

  // Grade a pick (no SR write — see the file header). The store no-ops once a question is graded,
  // so a stray click after answering is harmless.
  function onPick(id: string): void {
    challenge.answer(id);
  }
  function onMapPick(iso2: string): void {
    challenge.answer(iso2);
  }

  // Leave the feedback view: present the next question, or finalize the run (a clean-sweep pass or
  // the fatal miss). `advance()` returns true exactly when the run is over.
  function onContinue(): void {
    if (challenge.advance()) finalize();
  }

  function finalize(): void {
    const rich = challenge.summary();
    // Reveal the in-arena end screen (Phase 45 ④) — a run never routes to the generic /summary.
    ended = rich
      ? { passed: rich.passed, cleared: rich.cleared, total: rich.total, missed: rich.missed }
      : null;
    // No XP / no history (Phase 45 ⑤): record the finished run to the dedicated `grandmaster` store —
    // always consuming today's per-family×region attempt (win or lose), and certifying on a clean
    // sweep. NOT `saveSession` (⇒ zero XP / stats / streak) and never `recordAnswer` (⇒ no SR touch).
    if (rich) {
      void recordChallengeResult(rich.family, rich.region, rich.passed);
      // A clean sweep hands the just-earned capstone to Progress for a one-time "unlocked!" toast.
      if (rich.passed) justCertified.set({ family: rich.family, region: rich.region });
    }
    // Silence the bed, then crown a clean sweep with the victory fanfare. A failed run needs no extra
    // flourish — its descending-bell knell already rang at the fatal miss (see the verdict effect).
    sound.stopBed(rich?.passed ? 160 : 120);
    if (rich?.passed) sound.play('victory');
  }

  // Leave the finished run's end screen for Progress (where the gilded reward + prestige live).
  function returnToProgress(): void {
    challenge.reset();
    push('/progress');
  }

  function quit(): void {
    sound.stopBed(120);
    challenge.reset();
    push('/progress');
  }

  // Auto-advance once a question is answered — a short dwell on a correct clear, a longer one on the
  // fatal miss so its reveal can be read. Cancelled whenever the view leaves the answered state, so
  // it can never double-advance.
  $effect(() => {
    if ($challenge.status !== 'answered') return;
    const id = setTimeout(onContinue, dwellMs($challenge.feedback?.correct ?? false));
    return () => clearTimeout(id);
  });

  // Verdict cue: the relief-tinged 'settle' on a correct clear; on a miss (always fatal — one life),
  // the gauntlet fatal sequence (cut the bed → 'wrong' sag → descending-bell knell). Fires once per
  // graded question (same 'answered' gate as the auto-advance), so it can't double-fire.
  $effect(() => {
    if ($challenge.status !== 'answered') return;
    const fb = $challenge.feedback;
    if (!fb) return;
    if (fb.correct) sound.play('settle');
    else {
      // A miss is fatal: cancel the still-pending bed swell-in first, so it can't start over the
      // death reveal (nor cancel the knell), then run the cut → sag → knell sequence.
      if (bedStartTimer !== null) {
        clearTimeout(bedStartTimer);
        bedStartTimer = null;
      }
      sound.gauntletFatal();
      // Shake the arena + throw a one-shot white flash on the fatal slip (reduce-motion collapses
      // both via the arena guard). class:shake replays because it toggles false → true here.
      shaking = true;
      missed = true;
    }
  });

  // Tier-up (Phase 44): the bed escalates through 10 tiers as the board clears; each crossed N/10
  // boundary raises the live bed intensity and fires the 'surge' hit in step with it. Runs off the
  // live cleared/total, so it stays correct even if the run is resumed after navigating back.
  $effect(() => {
    const st = $challenge.state;
    if (!st) return;
    const tier = bedTierFor(st.cleared, st.total);
    if (lastBedTier === -1) {
      // First observation — sync the bed's tier without a Surge (covers start + resume).
      sound.setBedTier(tier);
      lastBedTier = tier;
      return;
    }
    if (tier === lastBedTier) return;
    if (tier > lastBedTier) {
      sound.play('surge');
      // Flash the just-crossed notch in step with the Surge cue (audio + visuals in lockstep).
      flashedTier = tier;
    }
    sound.setBedTier(tier);
    lastBedTier = tier;
  });
</script>

{#if $challenge.status !== 'idle'}
  {@const view = $challenge}
  {#if view.state && view.question && view.config}
    {@const s = view.state}
    {@const question = view.question}
    {@const cfg = view.config}
    {@const mode = question.mode}
    {@const answered = view.status === 'answered'}
    {@const fb = view.feedback}
    {@const clearedPct = s.total > 0 ? (s.cleared / s.total) * 100 : 0}

    <section
      class="gauntlet"
      class:shake={shaking}
      style="--heat-pct: {Math.round((heatTier / 9) * 100)}%; --intro-fade: {INTRO_FADE_MS}ms"
    >
      <GauntletEmbers tier={heatTier} {reduceMotion} />
      <div class="vignette" aria-hidden="true"></div>
      {#if missed}<div class="miss-flash" aria-hidden="true"></div>{/if}

      <!-- Cinematic entry (Phase 45 ③): the ceremonial title blooms on the dim ground, then this
           overlay crossfades out as the HUD fades in. Decorative — the run title also lives in the
           HUD; reduce-motion skips it entirely (introPhase stays 'live'). -->
      {#if introPhase !== 'live'}
        <div class="intro" class:leaving={introPhase === 'leaving'} aria-hidden="true">
          <div class="intro-inner">
            <div class="intro-crest"><GrandmasterCrest size={118} /></div>
            <h2 class="intro-title">{$t('challenge.intro.title')}</h2>
            <p class="intro-sub">
              {$t(`modes.group.${cfg.family}`)} · {$localizedRegion(cfg.region)}
            </p>
          </div>
        </div>
      {/if}

      <!-- Vertical tier sidebar: a bottom-anchored heat fill (= cleared/total) plus N/10 notches
           that light as passed and flash white on crossing — escalating with the run, in step with
           the Surge cue + the bed tier. -->
      <aside class="tier-rail" aria-hidden="true">
        <div class="track">
          <div class="heat-fill" style="height:{clearedPct}%"></div>
          {#each NOTCHES as n (n)}
            <span class="notch" class:lit={heatTier >= n} style="bottom:{n * 10}%"></span>
          {/each}
          {#key flashedTier}
            {#if flashedTier}<span class="notch-pop" style="bottom:{flashedTier * 10}%"></span>{/if}
          {/key}
        </div>
      </aside>

      <div class="arena-main" class:pre-live={introPhase === 'intro'}>
        <header class="topbar">
          <span class="run-title">
            {$t(`modes.group.${cfg.family}`)} · {$localizedRegion(cfg.region)}
          </span>
          <span
            class="counter"
            aria-label={$t('challenge.hud.cleared', { cleared: s.cleared, total: s.total })}
          >
            <b>{s.cleared}</b><span class="sep">/</span>{s.total}
          </span>
          <span class="life" title={$t('challenge.hud.oneLife')}>
            <svg class="heart" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
              />
            </svg>
          </span>
          <button type="button" class="forfeit" onclick={quit}>{$t('challenge.hud.quit')}</button>
        </header>

        <div class="prompt">
          {#if PROMPT_FLAG_MODES.includes(mode)}
            <div class="prompt-country-flag"><Flag country={question.answer} /></div>
          {/if}
          {#if mode === 'flag-to-country'}
            <div class="prompt-flag"><Flag country={question.answer} /></div>
            <p class="ask">{$t('play.prompt.whichCountry')}</p>
          {:else if mode === 'country-to-flag'}
            <p class="prompt-name">{$localizedName(question.answer)}</p>
            <p class="ask">{$t('play.prompt.whichFlag')}</p>
          {:else if mode === 'map-highlight'}
            <p class="ask">{$t('play.prompt.whichHighlighted')}</p>
          {:else if mode === 'map-locate'}
            <p class="prompt-name">{$localizedName(question.answer)}</p>
            <p class="ask">{$t('play.prompt.locate')}</p>
          {:else if mode === 'capital-to-country'}
            <p class="prompt-name">{$localizedText(question.answer.capital)}</p>
            <p class="ask">{$t('play.prompt.whichCountryOfCapital')}</p>
          {:else if mode === 'country-to-capital'}
            <p class="prompt-name">{$localizedName(question.answer)}</p>
            <p class="ask">{$t('play.prompt.whichCapital')}</p>
          {/if}
        </div>

        {#if isMapMode(mode)}
          <div class="board">
            {#if MapBoard}
              {@const pickedWrong =
                mode === 'map-locate' && answered && fb && !fb.correct
                  ? getCountry(fb.pickedIso ?? '')
                  : undefined}
              <MapBoard
                highlightIso={mode === 'map-highlight' ? question.answer.iso2 : null}
                interactive={mode === 'map-locate'}
                disabled={answered}
                pickedIso={mode === 'map-locate' ? (fb?.pickedIso ?? null) : null}
                pickedLabel={pickedWrong && pickedWrong.iso2 !== question.answer.iso2
                  ? $localizedName(pickedWrong)
                  : null}
                revealIso={mode === 'map-locate' && answered ? question.answer.iso2 : null}
                revealLabel={mode === 'map-locate' && answered
                  ? $localizedName(question.answer)
                  : null}
                focusIsos={continentIsos(cfg.region)}
                projection={$prefs.mapProjection}
                reduceMotion={$prefs.reduceMotion}
                questionKey={s.index}
                onpick={onMapPick}
              />
            {:else}
              <div class="placeholder" role="status">
                {mapFailed ? $t('play.map.error') : $t('play.map.loading')}
              </div>
            {/if}
          </div>
        {/if}

        {#if mode === 'map-locate'}
          <!-- The map is the answer surface; no separate picker. -->
        {:else if mode === 'country-to-flag' && question.options}
          {@const flagOptions = question.options.map((c) => ({
            id: c.iso2,
            label: $localizedName(c),
            country: c,
          }))}
          <div class="flag-scroll">
            <ChoiceGrid
              options={flagOptions}
              variant="flag"
              {answered}
              correctId={question.answer.iso2}
              pickedId={fb?.pickedIso ?? null}
              onpick={onPick}
            />
          </div>
        {:else if question.options}
          {@const nameOptions = question.options.map((c) => ({
            id: c.iso2,
            label: $localizedName(c),
          }))}
          <ChallengeSearchList
            options={nameOptions}
            placeholder={$t('challenge.search.countryPlaceholder')}
            {answered}
            correctId={question.answer.iso2}
            pickedId={fb?.pickedIso ?? null}
            onpick={onPick}
          />
        {:else if question.attributeOptions}
          {@const capitalOptions = question.attributeOptions.map((o) => ({
            id: o.id,
            label: $localizedText(o.label),
          }))}
          <ChallengeSearchList
            options={capitalOptions}
            placeholder={$t('challenge.search.capitalPlaceholder')}
            {answered}
            correctId={question.correctOptionId ?? null}
            pickedId={fb?.pickedIso ?? null}
            onpick={onPick}
          />
        {/if}

        {#if answered && fb}
          <div class="feedback" class:correct={fb.correct} class:wrong={!fb.correct} role="status">
            <p class="verdict">
              {fb.correct ? $t('play.feedback.correct') : $t('play.feedback.wrong')}
            </p>
            {#if !fb.correct}
              {#if mode === 'map-locate' && fb.pickedIso && fb.pickedIso !== question.answer.iso2}
                {@const picked = getCountry(fb.pickedIso)}
                {#if picked}
                  <div class="reveal-line picked-pick">
                    <span class="reveal-flag"><Flag country={picked} /></span>
                    <p class="reveal">
                      {$t('play.feedback.youPicked', { country: $localizedName(picked) })}
                    </p>
                  </div>
                {/if}
              {/if}
              <div class="reveal-line">
                {#if REVEAL_FLAG_MODES.includes(mode)}
                  <span class="reveal-flag"><Flag country={question.answer} /></span>
                {/if}
                <p class="reveal">
                  {$t('play.feedback.reveal', {
                    country:
                      mode === 'country-to-capital'
                        ? $localizedText(question.answer.capital)
                        : $localizedName(question.answer),
                  })}
                </p>
              </div>
            {/if}
            <div
              class="countdown"
              style="--countdown-ms: {dwellMs(fb.correct)}ms"
              aria-hidden="true"
            >
              <div class="countdown-fill"></div>
            </div>
          </div>
        {/if}
      </div>
    </section>
  {/if}
{/if}

<!-- In-arena end screen (Phase 45 ④): a clean sweep blooms gold; the fatal miss ends in a somber
     runover. Both Return to Progress — a run never routes to /summary. Self-contained (reads the
     finished `ended` rollup), so it renders after the run state has been cleared. -->
{#if ended}
  <section class="gauntlet gauntlet-end" class:victory={ended.passed} class:runover={!ended.passed}>
    {#if ended.passed}
      <div class="rays" aria-hidden="true"></div>
      <GauntletConfetti {reduceMotion} />
      <div class="bloom" role="status">
        <div class="bloom-crest"><GrandmasterCrest size={118} /></div>
        <p class="pill">{$t('challenge.victory.pill')}</p>
        <h1 class="shimmer-title">{$t('challenge.victory.title')}</h1>
        <p class="end-body">{$t('challenge.victory.body', { total: ended.total })}</p>
        <button type="button" class="end-return" onclick={returnToProgress}>
          {$t('challenge.victory.cta')}
        </button>
      </div>
    {:else}
      <div class="runover-inner" role="status">
        <div class="runover-crest"><GrandmasterCrest size={92} /></div>
        <h1 class="runover-title">{$t('challenge.runover.title')}</h1>
        <p class="end-body">
          {$t('challenge.runover.body', { cleared: ended.cleared, total: ended.total })}
        </p>
        {#if ended.missed}
          <span class="runover-missed">
            <span class="runover-missed-flag"><Flag country={ended.missed} /></span>
            {$t('challenge.runover.missed', { country: $localizedName(ended.missed) })}
          </span>
        {/if}
        <button type="button" class="end-return" onclick={returnToProgress}>
          {$t('challenge.endReturn')}
        </button>
        <p class="end-cooldown">{$t('challenge.endCooldown')}</p>
      </div>
    {/if}
  </section>
{/if}

<style>
  /* The Grandmaster arena (Phase 45): a scoped dark-teal "Orbi at nightfall" surface that bleeds
     out of the light app's `.content` padding. It re-defines the app's core `--color-*` tokens for
     its subtree, so the child pickers (ChoiceGrid / ChallengeSearchList / feedback) — which all
     style through those tokens (Phase 12) — render dark-teal without any change to those files. */
  .gauntlet {
    /* A full-screen takeover: the arena is `position: fixed` over the whole viewport, above the app
       shell (tab bar / rail / PWA prompt), so the light app never bleeds around it. There's no way
       out but to finish or Forfeit — reinforcing the one-life "you've entered the gauntlet" framing. */
    position: fixed;
    inset: 0;
    z-index: 70;
    isolation: isolate;
    display: flex;
    gap: clamp(0.6rem, 2vw, 1.4rem);
    padding: max(1.1rem, env(safe-area-inset-top)) max(0.9rem, env(safe-area-inset-right))
      max(1.4rem, env(safe-area-inset-bottom)) max(0.9rem, env(safe-area-inset-left));
    overflow: hidden; /* the main column scrolls; embers / vignette stay pinned to the viewport */
    background: radial-gradient(150% 100% at 50% 4%, var(--g-bg2), var(--g-bg) 68%);
    color: var(--g-ink);

    --heat: color-mix(in oklab, var(--g-gold), var(--g-ember) var(--heat-pct, 0%));
    --color-surface: #17453e;
    --color-bg: var(--g-bg);
    --color-border: var(--g-line);
    --color-text: var(--g-ink);
    --color-muted: var(--g-dim);
    --color-accent: var(--g-teal);
    --color-accent-strong: var(--g-teal-deep);
    --color-accent-weak: rgba(69, 201, 189, 0.16);
    --color-correct: var(--g-teal);
    --color-correct-bg: color-mix(in oklab, var(--g-teal), transparent 84%);
    --color-wrong: var(--g-crimson);
    --color-wrong-bg: color-mix(in oklab, var(--g-crimson), transparent 84%);
    --ring-selected: 0 0 0 3px rgba(69, 201, 189, 0.3);
    --shadow-card: 0 3px 0 rgb(0 0 0 / 28%);
  }

  @media (min-width: 860px) {
    .gauntlet {
      padding: 2rem 2.5rem;
      gap: 1.6rem;
    }
  }

  .gauntlet.shake {
    animation: gm-shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }

  /* A warming inner glow whose hue is the live heat — transitions as the run escalates. */
  .vignette {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    box-shadow: inset 0 0 130px 24px color-mix(in oklab, var(--heat), transparent 62%);
    transition: box-shadow 0.8s ease;
  }

  /* The one-shot white flash on the fatal miss. */
  .miss-flash {
    position: absolute;
    inset: 0;
    z-index: 6;
    pointer-events: none;
    background: #fff;
    animation: gm-flash 0.4s ease-out both;
  }

  /* ---- Vertical tier sidebar --------------------------------------------------------------- */
  .tier-rail {
    position: relative;
    z-index: 2;
    flex: 0 0 var(--sb);
    display: flex;
    justify-content: center;
    padding: 0.35rem 0;
  }

  .track {
    position: relative;
    align-self: stretch;
    width: 18px;
    border-radius: 999px;
    background: rgb(0 0 0 / 30%);
    border: 1px solid var(--g-line);
    overflow: hidden;
  }

  .heat-fill {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1;
    background: linear-gradient(180deg, color-mix(in oklab, var(--heat), #fff 34%), var(--heat));
    box-shadow: 0 -8px 18px color-mix(in oklab, var(--heat), transparent 45%);
    transition:
      height 0.35s cubic-bezier(0.2, 0.7, 0.2, 1),
      background 0.8s ease;
  }

  /* The bright leading edge of the heat fill. */
  .heat-fill::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 3px;
    background: rgb(255 255 255 / 90%);
  }

  .notch {
    position: absolute;
    left: 50%;
    z-index: 2;
    width: 10px;
    height: 2px;
    border-radius: 999px;
    background: var(--g-line);
    transform: translate(-50%, 50%);
  }

  .notch.lit {
    background: color-mix(in oklab, var(--heat), #fff 25%);
  }

  .notch-pop {
    position: absolute;
    left: 50%;
    z-index: 3;
    width: 16px;
    height: 3px;
    border-radius: 999px;
    background: #fff;
    transform: translate(-50%, 50%);
    animation: gm-notch-flash 0.6s ease-out both;
  }

  /* ---- Cinematic entry overlay ------------------------------------------------------------- */
  /* Sits on the same dark-teal ground as the arena, so only the crest/title fade out and the HUD
     content fades in over an unchanging ground (a clean crossfade, not a hard cut). */
  .intro {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background: radial-gradient(120% 90% at 50% 38%, var(--g-bg2), var(--g-bg) 70%);
    opacity: 1;
    transition: opacity var(--intro-fade, 600ms) ease;
  }

  .intro.leaving {
    opacity: 0;
    pointer-events: none;
  }

  .intro-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    text-align: center;
  }

  .intro-crest {
    animation: gm-floaty 4s ease-in-out infinite;
    filter: drop-shadow(0 0 22px color-mix(in oklab, var(--g-gold), transparent 55%));
  }

  .intro-title {
    margin: 0;
    font-family: var(--g-display);
    font-size: clamp(2rem, 8vw, 3.4rem);
    font-weight: 700;
    letter-spacing: 0.14em;
    background: var(--gold-metal);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: gm-titlein 1.9s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }

  .intro-sub {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--g-teal);
    animation: gm-subin 0.9s ease 0.55s both;
  }

  /* ---- Main column ------------------------------------------------------------------------- */
  .arena-main {
    position: relative;
    z-index: 2;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0; /* allow this flex child to shrink so it — not the fixed layer — scrolls */
    overflow-y: auto;
    overscroll-behavior: contain;
    /* A vertical scroll container clips BOTH axes (CSS forces overflow-x to match), so children
       flush to the edge get their colored box-shadows sliced with a hard vertical line — the search
       input's teal focus ring and the feedback glow both read as "cut sharp". This inline padding
       gives those shadows room to render inside the clip box; the max-width is bumped by the same
       amount (border-box) so the content column stays its intended 640px on desktop. */
    padding-inline: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    max-width: 664px;
    margin-inline: auto;
    width: 100%;
    opacity: 1;
    transition: opacity var(--intro-fade, 600ms) ease;
  }

  /* Hidden under the intro overlay until the crossfade begins (then fades in as the overlay fades
     out). Only ever set during the pre-live beat of a fresh, non-reduce-motion run. */
  .arena-main.pre-live {
    opacity: 0;
  }

  .topbar {
    display: flex;
    align-items: center;
    gap: 0.5rem 0.85rem;
    flex-wrap: wrap;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--g-line);
  }

  /* A HUD label, not a heading: the app's rounded UI font in uppercase + wide tracking reads as
     "chrome" and sits cleanly beside the mono counter (the serif display face is reserved for the
     ceremonial modal / victory titles). */
  .run-title {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--g-teal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .counter {
    font-family: var(--g-mono);
    font-size: 1.05rem;
    font-variant-numeric: tabular-nums;
    color: var(--g-dim);
  }

  .counter b {
    color: var(--g-gold);
    font-weight: 800;
  }

  .counter .sep {
    margin: 0 0.15rem;
    opacity: 0.55;
  }

  .life {
    display: inline-flex;
  }

  /* The single life: a crimson heart, beating for the run's duration. */
  .heart {
    width: 1.15rem;
    height: 1.15rem;
    fill: var(--g-crimson);
    transform-origin: center;
    animation: gm-beat 0.9s ease-in-out infinite;
  }

  .forfeit {
    padding: 0.32rem 0.8rem;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--g-faint);
    background: transparent;
    border: 1px solid var(--g-line);
    border-radius: 999px;
  }

  .forfeit:hover {
    color: var(--g-ink);
    border-color: var(--g-teal);
  }

  .prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0 0.2rem;
    text-align: center;
  }

  .prompt-flag {
    width: 100%;
    max-width: 260px;
  }

  .prompt-country-flag {
    width: 132px;
  }

  .prompt-name {
    margin: 0;
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--g-ink);
  }

  .ask {
    margin: 0;
    color: var(--g-dim);
  }

  .board {
    position: relative;
  }

  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 980 / 500;
    width: 100%;
    background: rgb(0 0 0 / 22%);
    border: 1px solid var(--g-line);
    border-radius: var(--radius);
    color: var(--g-dim);
  }

  /* The country-to-flag pool is the whole continent — scroll the flag grid inside its own box so a
     54-flag Africa run never runs the page long. */
  .flag-scroll {
    max-height: 46vh;
    overflow-y: auto;
    margin-inline: -0.25rem;
    /* Extra bottom padding so the last row scrolls clear of the fade; the mask dissolves overflow
       into the dark instead of a hard clip (matched padding keeps the last row fully readable). */
    padding: 0.25rem 0.25rem 2rem;
    -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 2rem), transparent);
    mask-image: linear-gradient(to bottom, #000 calc(100% - 2rem), transparent);
  }

  .feedback {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    padding: 1rem;
    border-radius: var(--radius);
    border: 1px solid var(--g-line);
    background: rgb(0 0 0 / 24%);
    animation: feedback-in 0.25s ease;
  }

  @keyframes feedback-in {
    from {
      transform: translateY(6px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  /* Correct answers glow teal (relief), not gold; a miss reads crimson. */
  .feedback.correct {
    border-color: var(--g-teal);
    background: color-mix(in oklab, var(--g-teal), transparent 84%);
    box-shadow: 0 0 26px -6px var(--g-teal);
  }

  .feedback.wrong {
    border-color: var(--g-crimson);
    background: color-mix(in oklab, var(--g-crimson), transparent 84%);
  }

  .verdict {
    margin: 0;
    font-weight: 700;
  }

  .feedback.correct .verdict {
    color: var(--g-teal);
  }

  .feedback.wrong .verdict {
    color: var(--g-crimson);
  }

  .reveal-line {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
  }

  .reveal-flag {
    flex: 0 0 auto;
    width: 52px;
  }

  .reveal {
    margin: 0;
    color: var(--g-ink);
  }

  .picked-pick .reveal {
    color: var(--g-crimson);
  }

  .countdown {
    width: 100%;
    max-width: 240px;
    height: 4px;
    margin-top: 0.2rem;
    background: rgb(0 0 0 / 34%);
    border-radius: 999px;
    overflow: hidden;
  }

  .countdown-fill {
    height: 100%;
    width: 100%;
    transform-origin: left center;
    background: var(--g-teal);
    animation: countdown var(--countdown-ms, 1500ms) linear forwards;
  }

  @keyframes countdown {
    from {
      transform: scaleX(1);
    }
    to {
      transform: scaleX(0);
    }
  }

  /* ---- In-arena end screens (Phase 45 ④) --------------------------------------------------- */
  /* Reuses `.gauntlet` (tokens + full-screen fixed layer + reduce-motion guard) but re-centres the
     flex-row arena into a single stacked column. */
  .gauntlet-end {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 1rem;
    /* An explicit opaque ground so the fixed overlay fully covers the app shell (the runover has no
       gold wash of its own; the .victory rule below layers gold over this same base). The ground is
       opaque from frame one — only the inner content fades in (below), so the app shell never peeks
       through during the reveal. */
    background: radial-gradient(150% 100% at 50% 4%, var(--g-bg2), var(--g-bg) 68%);
  }

  /* Victory: a warm gold radial washes over the dark-teal ground. */
  .gauntlet-end.victory {
    background:
      radial-gradient(
        120% 90% at 50% 42%,
        color-mix(in oklab, var(--g-gold), transparent 76%),
        transparent 60%
      ),
      radial-gradient(150% 100% at 50% 4%, var(--g-bg2), var(--g-bg) 68%);
  }

  /* Slow rotating conic ray field, radially masked so it fades before the edges. */
  .rays {
    position: absolute;
    inset: -25%;
    z-index: 0;
    pointer-events: none;
    background: repeating-conic-gradient(
      from 0deg at 50% 50%,
      color-mix(in oklab, var(--g-gold), transparent 86%) 0deg 5deg,
      transparent 5deg 15deg
    );
    -webkit-mask-image: radial-gradient(closest-side, #000 24%, transparent 76%);
    mask-image: radial-gradient(closest-side, #000 24%, transparent 76%);
    opacity: 0.75;
    animation: gm-spin 64s linear infinite;
  }

  .bloom,
  .runover-inner {
    position: relative;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.7rem;
    max-width: 30rem;
    padding: 1rem;
    /* Only the content fades in — the opaque ground behind it is painted from frame one. */
    animation: gm-hudin 0.6s ease both;
  }

  .bloom-crest {
    animation: gm-floaty 4s ease-in-out infinite;
    filter: drop-shadow(0 0 26px color-mix(in oklab, var(--g-gold), transparent 45%));
  }

  .pill {
    margin: 0;
    padding: 0.28rem 0.9rem;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--g-gold);
    background: color-mix(in oklab, var(--g-gold), transparent 88%);
    border: 1px solid color-mix(in oklab, var(--g-gold), transparent 60%);
    border-radius: 999px;
  }

  /* The shimmering GRANDMASTER title — a moving gold sheen swept across gradient-clipped text. */
  .shimmer-title {
    margin: 0;
    font-family: var(--g-display);
    font-size: clamp(2.4rem, 10vw, 4.4rem);
    font-weight: 700;
    letter-spacing: 0.12em;
    line-height: 1.05;
    background: linear-gradient(
      100deg,
      #d9a94a 0%,
      #ffe083 25%,
      #fff6da 50%,
      #ffe083 75%,
      #d9a94a 100%
    );
    background-size: 220% auto;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: gm-shimmer 3.2s linear infinite;
  }

  .end-body {
    margin: 0;
    color: var(--g-ink);
    font-weight: 600;
  }

  .end-return {
    margin-top: 0.4rem;
    padding: 0.7rem 1.8rem;
    border-radius: 999px;
    font-weight: 700;
    font-size: 0.95rem;
    color: #4a2f00;
    background: var(--g-cta);
    border: none;
    box-shadow: var(--g-cta-shadow);
  }

  .end-return:hover {
    filter: brightness(1.04);
  }

  .end-return:active {
    transform: translateY(2px);
    box-shadow: 0 2px 0 #9c7328;
  }

  .end-cooldown {
    margin: 0.1rem 0 0;
    font-size: 0.82rem;
    color: var(--g-faint);
  }

  /* Runover: somber — the crest dims, no gold wash, the title in ink. */
  .runover-crest {
    opacity: 0.45;
    filter: grayscale(0.35);
  }

  .runover-title {
    margin: 0;
    font-family: var(--g-display);
    font-size: clamp(1.7rem, 6vw, 2.6rem);
    font-weight: 700;
    color: var(--g-ink);
  }

  .runover-missed {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.1rem;
    padding: 0.3rem 0.8rem 0.3rem 0.4rem;
    border-radius: 999px;
    background: color-mix(in oklab, var(--g-crimson), transparent 84%);
    border: 1px solid color-mix(in oklab, var(--g-crimson), transparent 55%);
    color: var(--g-crimson);
    font-weight: 700;
  }

  .runover-missed-flag {
    width: 32px;
    flex: 0 0 auto;
  }

  @media (max-width: 640px) {
    .gauntlet {
      --sb: 22px;
      gap: 0.5rem;
      padding: 0.9rem 0.7rem 1.2rem;
    }
    .track {
      width: 7px;
    }
    .notch {
      width: 6px;
    }
    .notch-pop {
      width: 11px;
    }
    .board {
      margin-inline: -0.5rem;
    }
    .placeholder {
      aspect-ratio: 3 / 2;
    }
  }
</style>
