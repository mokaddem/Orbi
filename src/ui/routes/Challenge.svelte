<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { push } from 'svelte-spa-router';
  import { t, localizedName, localizedText, localizedRegion } from '../../i18n';
  import { isMapMode, filterCountries, type GameMode } from '../../domain';
  import { getCountries, getCountry } from '../../data';
  import { challenge, pendingChallenge, lastChallengeSummary } from '../stores/challenge';
  import { lastSummary, lastBlitzResult } from '../stores/game';
  import { prefs, saveSession } from '../stores/persistence';
  import { sound } from '../sound';
  import { bedTierFor } from '../sound.bed';
  import Flag from '../components/Flag.svelte';
  import ChoiceGrid from '../components/ChoiceGrid.svelte';
  import ChallengeSearchList from '../components/ChallengeSearchList.svelte';
  import Icon from '../components/Icon.svelte';

  // The Grandmaster Run Play shell (Phase 44). Drives the dedicated one-life `challenge` store —
  // deliberately separate from `Play.svelte` / `QuizSession`, since a run interleaves both of a
  // family's directions, holds the whole continent as fixed options (no 4-choice crutch), and ends
  // on the first miss. A run is a *test* of already-mastered material, so on finish it records to
  // history (feeding XP / stats / the capstone badges via `saveSession`) but NEVER writes
  // spaced-repetition — a single fatal slip must not demote the mastery that unlocked the run.

  // A correct answer flashes briefly then advances; a miss (fatal — the run is over) lingers on the
  // reveal before the fail Summary. Fixed by design, matching Play's dwell feel.
  const CORRECT_MS = 1200;
  const REVEAL_MS = 3200;
  const dwellMs = (correct: boolean): number => (correct ? CORRECT_MS : REVEAL_MS);

  // Audio (Phase 44 — the Grandmaster Challenge score, see docs/gauntlet-audio-spec.md). The shell
  // has no visual arena transition, so "Enter the Arena" plays at run start and the looping bed
  // swells in a beat later — the audio stands in for the transition. Tunable in-app.
  const BED_START_DELAY_MS = 950;
  let bedStartTimer: ReturnType<typeof setTimeout> | null = null;
  // The last bed intensity tier seen, so a tier-up (a crossed N/10 boundary) triggers the Surge
  // once. `-1` = uninitialized: the first observation just syncs the bed (no Surge), which also
  // keeps a resumed mid-run run from firing a spurious Surge. Per component instance.
  let lastBedTier = -1;

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
      lastChallengeSummary.set(null);
      challenge.start(pending);
      // Enter the Arena on accept, then swell the bed in after a beat (the audio transition).
      sound.play('enter');
      bedStartTimer = setTimeout(() => {
        bedStartTimer = null;
        sound.startBed();
      }, BED_START_DELAY_MS);
    } else {
      const view = get(challenge);
      if (view.status === 'idle' || view.status === 'finished') {
        challenge.reset();
        push('/progress');
      } else {
        // Resuming an in-flight run (navigated back mid-run): restore the bed, no Enter cue.
        sound.startBed();
      }
    }
    // The bed must never outlive the route; quit/finalize handle the normal stops, this is the net.
    return () => {
      if (bedStartTimer !== null) clearTimeout(bedStartTimer);
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
    const summary = challenge.sessionSummary();
    lastChallengeSummary.set(rich);
    lastSummary.set(summary);
    lastBlitzResult.set(null); // a challenge finish clears any prior blitz result
    // History / XP / capstone badges only — never `recordAnswer` (a run must not touch SR).
    if (summary) void saveSession(summary);
    // Silence the bed, then crown a clean sweep with the victory fanfare. A failed run needs no extra
    // flourish — its descending-bell knell already rang at the fatal miss (see the verdict effect).
    sound.stopBed(rich?.passed ? 160 : 120);
    if (rich?.passed) sound.play('victory');
    push('/summary');
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
    else sound.gauntletFatal();
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
    if (tier > lastBedTier) sound.play('surge');
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

    <section class="game">
      <header class="hud">
        <div class="run-id">
          <span class="crown" aria-hidden="true"><Icon name="crown" size="1.05em" /></span>
          <span class="run-name">
            {$t(`modes.group.${cfg.family}`)} · {$localizedRegion(cfg.region)}
          </span>
        </div>
        <div class="progress">
          <div class="bar">
            <div class="fill" style="width:{clearedPct}%"></div>
          </div>
          <span class="counter">
            {$t('challenge.hud.cleared', { cleared: s.cleared, total: s.total })}
          </span>
        </div>
        <div class="hud-tail">
          <span class="one-life" title={$t('challenge.hud.oneLife')}>
            <svg class="heart" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
              />
            </svg>
            {$t('challenge.hud.oneLife')}
          </span>
          <button type="button" class="quit" onclick={quit}>{$t('challenge.hud.quit')}</button>
        </div>
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
          <div class="countdown" style="--countdown-ms: {dwellMs(fb.correct)}ms" aria-hidden="true">
            <div class="countdown-fill"></div>
          </div>
        </div>
      {/if}
    </section>
  {/if}
{/if}

<style>
  .game {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    max-width: 640px;
    margin-inline: auto;
    width: 100%;
  }

  .hud {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1rem;
    flex-wrap: wrap;
  }

  /* The run's identity: a gold crown + "{family} · {continent}", so the player always sees which
     Grandmaster Run they're proving. */
  .run-id {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 800;
    min-width: 0;
  }

  .crown {
    display: inline-flex;
    color: var(--color-sun);
  }

  .run-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .progress {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 12rem;
    flex: 1;
  }

  .bar {
    height: 8px;
    background: var(--color-border);
    border-radius: 999px;
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: var(--progress-gradient);
    transition: width 0.2s ease;
  }

  .counter {
    font-size: 0.9rem;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  .hud-tail {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
  }

  /* The single-life marker: one heart + "One life", the sudden-death tension of a prove-it run. */
  .one-life {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--color-wrong);
  }

  .heart {
    width: 1rem;
    height: 1rem;
    fill: var(--color-wrong);
  }

  .quit {
    padding: 0.3rem 0.7rem;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-muted);
  }

  .prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 0;
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
    text-align: center;
  }

  .ask {
    margin: 0;
    color: var(--color-muted);
  }

  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 980 / 500;
    width: 100%;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-muted);
  }

  /* The country-to-flag pool is the whole continent — scroll the flag grid inside its own box so a
     54-flag Africa run never runs the page long. */
  .flag-scroll {
    max-height: 46vh;
    overflow-y: auto;
    margin-inline: -0.25rem;
    padding: 0.25rem;
  }

  .feedback {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    padding: 1rem;
    border-radius: var(--radius);
    border: 1px solid var(--color-border);
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

  .feedback.correct {
    background: var(--color-correct-bg);
    border-color: var(--color-correct);
  }

  .feedback.wrong {
    background: var(--color-wrong-bg);
    border-color: var(--color-wrong);
  }

  .verdict {
    margin: 0;
    font-weight: 700;
  }

  .feedback.correct .verdict {
    color: var(--color-correct);
  }

  .feedback.wrong .verdict {
    color: var(--color-wrong);
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
    color: var(--color-text);
  }

  .picked-pick .reveal {
    color: var(--color-wrong);
  }

  .countdown {
    width: 100%;
    max-width: 240px;
    height: 4px;
    margin-top: 0.2rem;
    background: var(--color-border);
    border-radius: 999px;
    overflow: hidden;
  }

  .countdown-fill {
    height: 100%;
    width: 100%;
    transform-origin: left center;
    background: var(--color-accent);
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

  @media (max-width: 640px) {
    .board {
      margin-inline: -0.5rem;
    }
    .placeholder {
      aspect-ratio: 3 / 2;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .countdown-fill,
    .feedback,
    .fill {
      animation: none;
      transition: none;
    }
  }
</style>
