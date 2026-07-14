<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { get } from 'svelte/store';
  import { push } from 'svelte-spa-router';
  import { t, localizedName, localizedText, localizedRegion } from '../../i18n';
  import {
    hasOptions,
    isMapMode,
    isMultiSelectMode,
    type GameMode,
    type RegionFilter,
    type SessionType,
  } from '../../domain';
  import {
    countryCount,
    getCountries,
    getCountry,
    getRegionTree,
    type RegionNode,
  } from '../../data';
  import {
    play,
    lastSummary,
    pendingConfig,
    focusIsosForConfig,
    type RunConfig,
  } from '../stores/game';
  import { prefs, saveSession, saveDailyResult, recordAnswer } from '../stores/persistence';
  import { sound } from '../sound';
  import { streakTier, isStreakMilestone, streakBurstSpec } from '../streak';
  import Flag from '../components/Flag.svelte';
  import StreakBurst from '../components/StreakBurst.svelte';
  import PageHero from '../components/PageHero.svelte';
  import ChoiceGrid from '../components/ChoiceGrid.svelte';
  import SegmentedControl from '../components/SegmentedControl.svelte';
  import ModeIcon from '../components/ModeIcon.svelte';
  import ModeGroupIcon, { type ModeGroup } from '../components/ModeGroupIcon.svelte';
  import RegionIcon from '../components/RegionIcon.svelte';
  import Icon from '../components/Icon.svelte';

  // Auto-advance timings (ms): a brief dwell on a plain correct answer, a longer one
  // whenever there's a reveal to read. Fixed by design (not a setting).
  const CORRECT_MS = 1500;
  const REVEAL_MS = 4500;

  // Milestone-pop pulse (Phase 39): bumped each time the streak lands on a milestone, so the
  // streak indicator replays its celebratory scale-bump + heat flash at that moment only. The
  // sticky streak *tier* (which grows the jingle) lives in `../streak`.
  let milestonePulse = $state(0);

  // Milestone burst (Phase 42): the escalating particle celebration that fires alongside the pill's
  // heat flash. `streakEl` is the flame pill we measure to anchor the burst; the burst renders in a
  // fixed overlay (via `StreakBurst`) so it can spill past the play view's clipping scroll container.
  // `burstKey` remounts the overlay on each milestone so its one-shot animations replay.
  let streakEl = $state<HTMLElement>();
  let burstTier = $state(-1);
  let burstX = $state(0);
  let burstY = $state(0);
  let burstKey = $state(0);
  const reducedMotionQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  // Fire the burst for a milestone tier, anchored on the flame. Skipped entirely under reduced
  // motion (OS setting or the in-app toggle) — the pill's own animation is neutralised by the
  // existing reduce-motion CSS, matching how the rest of the app degrades. Measured on the next
  // frame so the keyed pill has re-rendered and laid out before we read its box.
  function triggerBurst(tier: number): void {
    if (get(prefs).reduceMotion || reducedMotionQuery?.matches) return;
    requestAnimationFrame(() => {
      const el = streakEl;
      if (!el) return;
      const r = el.getBoundingClientRect();
      burstX = r.left + Math.min(r.height * 0.5 + 2, r.width); // ~centre of the leading flame glyph
      burstY = r.top + r.height / 2;
      burstTier = tier;
      burstKey += 1;
    });
  }

  // A reveal is shown — so linger for REVEAL_MS rather than CORRECT_MS — on any wrong
  // answer, and also on a *correct* industries answer (which lists the country's full set
  // of main industries, not just the one picked). Everything else advances quickly.
  function dwellMs(
    fb: { correct: boolean; question: { mode: GameMode } } | null | undefined,
  ): number {
    if (!fb) return CORRECT_MS;
    const hasReveal = !fb.correct || fb.question.mode === 'country-to-industry';
    return hasReveal ? REVEAL_MS : CORRECT_MS;
  }

  // Setup selections. `category` is the chosen mode *family* (category-first picker, Phase 35);
  // `mode` is the specific direction within it. They start on Flags → "Flag → Country".
  let category = $state<ModeGroup>('flags');
  let mode = $state<GameMode>('flag-to-country');
  let type = $state<SessionType>('fixed');

  /**
   * The selectable modes grouped into families for the category-first picker. Each family
   * offers its two direction modes; `key` maps to `modes.group.*` labels and the emblem chip.
   */
  const MODE_GROUPS: { key: ModeGroup; modes: { mode: GameMode; labelKey: string }[] }[] = [
    {
      key: 'map',
      modes: [
        { mode: 'map-highlight', labelKey: 'modes.mapHighlight' },
        { mode: 'map-locate', labelKey: 'modes.mapLocate' },
      ],
    },
    {
      key: 'flags',
      modes: [
        { mode: 'flag-to-country', labelKey: 'modes.flagToCountry' },
        { mode: 'country-to-flag', labelKey: 'modes.countryToFlag' },
      ],
    },
    {
      key: 'capitals',
      modes: [
        { mode: 'capital-to-country', labelKey: 'modes.capitalToCountry' },
        { mode: 'country-to-capital', labelKey: 'modes.countryToCapital' },
      ],
    },
    {
      key: 'extra',
      modes: [
        { mode: 'country-to-languages', labelKey: 'modes.countryToLanguages' },
        { mode: 'country-to-industry', labelKey: 'modes.mainIndustries' },
      ],
    },
  ];

  // The family whose direction modes are shown in the tray. Falls back defensively to the first.
  const activeGroup = $derived(MODE_GROUPS.find((g) => g.key === category) ?? MODE_GROUPS[0]);

  // Selecting a family shows its directions; if the current `mode` doesn't belong to the new
  // family, land on that family's first direction so `mode` is always valid and in-scope.
  function selectCategory(key: ModeGroup): void {
    category = key;
    const group = MODE_GROUPS.find((g) => g.key === key);
    if (group && !group.modes.some((m) => m.mode === mode)) {
      mode = group.modes[0].mode;
    }
  }

  // Country-centric modes where a wrong-answer reveal benefits from the correct country's
  // flag beside the name — the flag wasn't the question here (unlike the flag↔country modes,
  // where showing it would be redundant with the prompt/answer).
  const REVEAL_FLAG_MODES: GameMode[] = [
    'map-highlight',
    'map-locate',
    'capital-to-country',
    'country-to-capital',
  ];
  // Attribute modes prompted by a country name: anchor the prompt with the country's flag.
  // The answer is a capital / language / industry, so the flag never gives it away.
  const PROMPT_FLAG_MODES: GameMode[] = [
    'country-to-capital',
    'country-to-languages',
    'country-to-industry',
  ];

  // Region filter selections. Empty string means "no narrowing": no region → World
  // (all countries); no sub-region → the whole selected region.
  const regionTree = getRegionTree();
  let selectedRegion = $state<string>('');
  let selectedSubregion = $state<string>('');

  const regionNode = $derived<RegionNode | null>(
    selectedRegion ? (regionTree.find((r) => r.region === selectedRegion) ?? null) : null,
  );
  const subregions = $derived(regionNode?.subregions ?? []);

  // Option lists for the region / sub-region selectors, localized reactively.
  // SegmentedControl renders them as buttons when short, else falls back to a dropdown.
  const regionOptions = $derived([
    { value: '', label: $t('play.setup.regionWorld') },
    ...regionTree.map((r) => ({ value: r.region, label: $localizedRegion(r.region) })),
  ]);
  const subregionOptions = $derived(
    selectedRegion
      ? [
          {
            value: '',
            label: $t('play.setup.subregionAll', { region: $localizedRegion(selectedRegion) }),
          },
          ...subregions.map((s) => ({ value: s.subregion, label: $localizedRegion(s.subregion) })),
        ]
      : [],
  );

  // How many countries the current selection actually asks about — drives the pool
  // hint and the small-region guard below. Read from the pre-counted region tree.
  const poolSize = $derived.by(() => {
    if (!regionNode) return countryCount();
    if (selectedSubregion) {
      return (
        regionNode.subregions.find((s) => s.subregion === selectedSubregion)?.countries.length ?? 0
      );
    }
    return regionNode.countries.length;
  });

  // Small-region guard (option modes only): a pool smaller than the configured number
  // of choices can't fill N options, so the question shrinks to what it can supply.
  const effectiveChoices = $derived(Math.min($prefs.choicesPerQuestion, poolSize));
  const optionsReduced = $derived(hasOptions(mode) && effectiveChoices < $prefs.choicesPerQuestion);

  function selectRegion(region: string): void {
    selectedRegion = region;
    selectedSubregion = ''; // a stale sub-region wouldn't belong to the new region
  }

  // The map board pulls in d3-geo + the TopoJSON chunk, so it is lazy-imported only
  // once a map-mode session is under way — flag-only sessions never pay for it.
  let MapBoard = $state<typeof import('../components/MapBoard.svelte').default | null>(null);
  let mapFailed = $state(false);

  $effect(() => {
    const cfg = $play.config;
    if (cfg && isMapMode(cfg.mode) && !MapBoard && !mapFailed) {
      import('../components/MapBoard.svelte')
        .then((m) => (MapBoard = m.default))
        .catch(() => (mapFailed = true));
    }
  });

  // Auto-start a staged config (e.g. Retry from the summary); otherwise leave a
  // finished session behind so this route shows setup, and resume an in-progress one.
  onMount(() => {
    const pending = get(pendingConfig);
    if (pending) {
      pendingConfig.set(null);
      play.start(pending);
      return;
    }
    if (get(play).status === 'finished') play.reset();
  });

  function startGame(): void {
    const filter: RegionFilter | undefined = selectedRegion
      ? { region: selectedRegion, ...(selectedSubregion ? { subregion: selectedSubregion } : {}) }
      : undefined;
    const p = $prefs;
    play.start({
      mode,
      type,
      filter,
      fixedLength: p.fixedLength,
      lives: p.survivalLives,
      choices: p.choicesPerQuestion,
    });
  }

  function onPick(id: string): void {
    const result = play.answer(id);
    if (result) void recordAnswer(result);
  }

  // Multi-select (country-to-languages): the player toggles several options, then submits.
  // Selection is local to the current question and cleared whenever the question changes.
  let selected = $state<string[]>([]);
  let selectionKey: string | null = null;
  $effect(() => {
    const key = $play.status === 'playing' ? ($play.question?.itemKey ?? null) : selectionKey;
    if (key !== selectionKey) {
      selectionKey = key;
      selected = [];
    }
  });

  function toggleSelect(id: string): void {
    selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
  }

  function submitMulti(): void {
    const result = play.answer([...selected]);
    if (result) void recordAnswer(result);
  }

  // map-locate: the map is the answer surface. `play.answer` no-ops once the current
  // question is graded, so a stray click after answering is harmless.
  function onMapPick(iso2: string): void {
    const result = play.answer(iso2);
    if (result) void recordAnswer(result);
  }

  function onContinue(): void {
    const finished = play.advance();
    if (finished) {
      const summary = play.summary();
      lastSummary.set(summary);
      if (summary) {
        void saveSession(summary);
        // If this was the Daily Challenge, record its result so Home shows "done today".
        // It's still a normal session otherwise (feeds SR + history like any other run).
        const dailyDate = get(play).config?.dailyDate;
        if (dailyDate) {
          void saveDailyResult({
            date: dailyDate,
            completed: true,
            total: summary.total,
            correct: summary.correct,
            mode: summary.mode,
          });
        }
        // End-of-session jingle (Phase 36): the Daily Challenge gets its own habit jingle; an
        // otherwise-flawless run gets the celebratory peak; every other finish, the soft resolve.
        // Fires well after the last per-question cue (auto-advance dwell), so they never overlap.
        if (dailyDate) sound.play('daily');
        else if (summary.total > 0 && summary.correct === summary.total) sound.play('perfect');
        else sound.play('finish');
      }
      push('/summary');
    }
  }

  function quit(): void {
    play.reset();
  }

  // Auto-advance: once a question is answered, show feedback briefly, then move on with
  // no manual "Continue" — a longer dwell on a wrong answer so the reveal can be read.
  // The timer is cancelled whenever the view leaves the answered state (next question,
  // quit, or unmount), so it can never double-advance.
  $effect(() => {
    if ($play.status !== 'answered') return;
    const id = setTimeout(onContinue, dwellMs($play.feedback));
    return () => clearTimeout(id);
  });

  // Verdict cue (Phase 36 / 39): a warm rising mallet on correct, a soft low tone on wrong. Once a
  // streak milestone is reached the celebratory `streak` cue takes over and *sticks* — every
  // subsequent correct answer plays it at the current tier (grander each milestone) rather than
  // falling back to `correct`; only below the first milestone does plain `correct` play. Reaching a
  // new milestone also pulses the streak indicator. Fires once per graded question — same 'answered'
  // gate as the auto-advance timer, so it can't double-fire. The end-of-session jingle comes later
  // (in onContinue) and never overlaps this short cue.
  $effect(() => {
    if ($play.status !== 'answered') return;
    const fb = $play.feedback;
    if (!fb) return;
    if (!fb.correct) {
      sound.play('wrong');
      return;
    }
    const streak = $play.state?.streak ?? 0;
    const tier = streakTier(streak);
    if (tier >= 0) sound.play('streak', { level: tier });
    else sound.play('correct');
    // Bump the pop pulse without a *tracked* read of it — reading `milestonePulse` inside this
    // effect (as `+= 1` would) then writing it back is a self-invalidating loop. Reaching a
    // milestone also fires the escalating burst, anchored on the (now heating) flame pill.
    if (isStreakMilestone(streak)) {
      milestonePulse = untrack(() => milestonePulse) + 1;
      triggerBurst(tier);
    }
  });

  // ISO codes to frame the map on, for a region-scoped map session. Memoized by config
  // identity so it returns a *stable* array within a session — the config object is set
  // once per session, so the map's projection is computed once, not per question. The
  // scope selection (region filter *or* region-expanded answer pool) lives in
  // `focusIsosForConfig` so it stays pure and unit-tested.
  let focusCfg: RunConfig | null = null;
  let focusIsos: string[] | null = null;
  function mapFocusIsos(cfg: RunConfig | null): string[] | null {
    if (cfg === focusCfg) return focusIsos;
    focusCfg = cfg;
    focusIsos = focusIsosForConfig(getCountries(), cfg);
    return focusIsos;
  }
</script>

{#if $play.status === 'idle'}
  <section class="setup">
    <PageHero title={$t('play.title')} pose="wave" />

    <div class="field">
      <span class="legend" id="mode-legend">{$t('play.setup.chooseMode')}</span>

      <!-- Category-first (Phase 35): pick a family, then a direction. -->
      <div class="cat-grid" role="group" aria-labelledby="mode-legend">
        {#each MODE_GROUPS as group (group.key)}
          <button
            type="button"
            class="cat-card {group.key}"
            class:selected={category === group.key}
            aria-pressed={category === group.key}
            onclick={() => selectCategory(group.key)}
          >
            <span class="cat-chip"><ModeGroupIcon group={group.key} /></span>
            <span class="cat-text">
              <span class="cat-name">{$t(`modes.group.${group.key}`)}</span>
              <span class="cat-hint">{$t(`modes.groupHint.${group.key}`)}</span>
            </span>
          </button>
        {/each}
      </div>

      <!-- Direction sub-choice for the selected family. Re-keyed on `category` so the tray
           animates in whenever the family changes. -->
      {#key category}
        <div class="dir-tray" role="group" aria-label={$t('play.setup.pickDirection')}>
          <span class="dir-legend">{$t('play.setup.pickDirection')}</span>
          <div class="dir-row">
            {#each activeGroup.modes as opt (opt.mode)}
              <button
                type="button"
                class="opt mode-opt dir-opt"
                class:selected={mode === opt.mode}
                aria-pressed={mode === opt.mode}
                onclick={() => (mode = opt.mode)}
              >
                <ModeIcon mode={opt.mode} />
                <span>{$t(opt.labelKey)}</span>
              </button>
            {/each}
          </div>
        </div>
      {/key}
    </div>

    <div class="field">
      <span class="legend">{$t('play.setup.chooseType')}</span>
      <div class="format-grid">
        <button
          type="button"
          class="opt"
          class:selected={type === 'fixed'}
          aria-pressed={type === 'fixed'}
          onclick={() => (type = 'fixed')}
        >
          <span class="opt-title"
            ><Icon name="fixed" size="1.05em" /> {$t('sessionType.fixed')}</span
          >
          <small>{$t('play.setup.fixedHint', { count: $prefs.fixedLength })}</small>
        </button>
        <button
          type="button"
          class="opt"
          class:selected={type === 'survival'}
          aria-pressed={type === 'survival'}
          onclick={() => (type = 'survival')}
        >
          <span class="opt-title"
            ><Icon name="survival" size="1.05em" /> {$t('sessionType.survival')}</span
          >
          <small>{$t('play.setup.survivalHint', { lives: $prefs.survivalLives })}</small>
        </button>
        <!-- Grand Tour (Phase 35): every country in the chosen scope, once, uncapped. -->
        <button
          type="button"
          class="opt fmt-full"
          class:selected={type === 'full'}
          aria-pressed={type === 'full'}
          onclick={() => (type = 'full')}
        >
          <span class="opt-title"><Icon name="globe" size="1.05em" /> {$t('sessionType.full')}</span
          >
          <small>{$t('play.setup.fullHint', { count: poolSize })}</small>
        </button>
      </div>
    </div>

    <div class="field">
      <span class="legend" id="region-legend">{$t('play.setup.chooseRegion')}</span>
      <div class="region-selects">
        <div class="region-grid" role="group" aria-label={$t('play.setup.chooseRegion')}>
          {#each regionOptions as opt (opt.value)}
            <button
              type="button"
              class="region-opt"
              class:selected={selectedRegion === opt.value}
              aria-pressed={selectedRegion === opt.value}
              onclick={() => selectRegion(opt.value)}
            >
              <span class="region-ico"><RegionIcon region={opt.value} /></span>
              <span class="region-label">{opt.label}</span>
            </button>
          {/each}
        </div>

        <!-- Only offer the sub-region picker when the region is actually subdivided;
             a region with a single bucket (Oceania) would just show a redundant button. -->
        {#if subregions.length > 1}
          <SegmentedControl
            options={subregionOptions}
            value={selectedSubregion}
            onchange={(v) => (selectedSubregion = v)}
            ariaLabel={$localizedRegion(selectedRegion)}
          />
        {/if}
      </div>
      <small class="pool-hint" role="status">
        {#if optionsReduced}
          {$t('play.setup.poolReduced', { count: poolSize, choices: effectiveChoices })}
        {:else}
          {$t('play.setup.poolCount', { count: poolSize })}
        {/if}
      </small>
    </div>

    <button type="button" class="start" onclick={startGame}>{$t('play.setup.start')}</button>

    <a class="practice-link" href="#/practice">
      <Icon name="target" size={15} />
      <span>{$t('play.setup.targetedPractice')}</span>
    </a>
  </section>
{:else}
  {@const view = $play}
  {#if view.state && view.question && view.config}
    {@const s = view.state}
    {@const question = view.question}
    {@const cfg = view.config}
    {@const total = cfg.fixedLength ?? $prefs.fixedLength}
    {@const lives = cfg.lives ?? $prefs.survivalLives}
    {@const answered = view.status === 'answered'}

    <section class="game">
      <header class="hud">
        {#if cfg.type !== 'survival'}
          <div class="progress">
            <div class="bar">
              <div class="fill" style="width:{(s.results.length / total) * 100}%"></div>
            </div>
            <span class="counter">
              {$t('play.progress.question', { current: Math.min(s.index + 1, total), total })}
            </span>
          </div>
        {:else}
          <!-- Survival now ends in a "region cleared" win once every country in the pool has
               been answered correctly at least once (Phase 40), so the HUD shows progress toward
               that goal — distinct countries mastered out of the pool size — rather than a raw
               answered count. This makes the finish feel earned, never random. -->
          {@const mastered = new Set(s.results.filter((r) => r.correct).map((r) => r.countryIso2))
            .size}
          <div
            class="lives"
            aria-label={$t('play.progress.livesRemaining', {
              remaining: s.livesRemaining,
              total: lives,
            })}
          >
            {#each Array.from({ length: lives }, (_, i) => i) as i (i)}
              <svg
                class="heart"
                class:lost={i >= s.livesRemaining}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
                />
              </svg>
            {/each}
            {#if view.answerCount}
              <span class="mastered"
                >{$t('play.progress.mastered', { count: mastered, total: view.answerCount })}</span
              >
            {/if}
          </div>
        {/if}

        <div class="score">
          <span>{$t('play.progress.score', { correct: s.correct, total: s.results.length })}</span>
          {#if s.streak > 1}
            <!-- Keyed on the milestone pulse so the celebratory pop replays only when a new
                 milestone is reached (`at-milestone`); ordinary correct answers just update the
                 count with the base appear-pop. At a milestone the pill's heat/scale/glow escalates
                 by tier via `streakBurstSpec`, in step with the jingle. -->
            {@const ms = isStreakMilestone(s.streak) ? streakBurstSpec(streakTier(s.streak)) : null}
            {#key milestonePulse}
              <span
                class="streak"
                class:at-milestone={ms !== null}
                bind:this={streakEl}
                style={ms
                  ? `--ms-scale:${ms.peakScale}; --ms-glow:${ms.glow}px; --ms-bright:${ms.bright}; --ms-dur:${ms.durMs}ms; --ms-heat:${ms.heat}`
                  : ''}
                ><Icon name="flame" size="0.95em" />
                {$t('play.progress.streak', { streak: s.streak })}</span
              >
            {/key}
          {/if}
          <button type="button" class="quit" onclick={quit}>{$t('play.quit')}</button>
        </div>
      </header>

      <!-- Milestone burst overlay (Phase 42). Fixed-position, so its DOM location here is immaterial;
           `{#key burstKey}` remounts it on each milestone to replay the escalating one-shot burst. -->
      {#if burstTier >= 0}
        {#key burstKey}
          <StreakBurst tier={burstTier} x={burstX} y={burstY} />
        {/key}
      {/if}

      <div class="prompt">
        {#if PROMPT_FLAG_MODES.includes(cfg.mode)}
          <!-- Anchor the country name with its flag (capitals / languages / industries):
               the answer is an attribute, so the flag is a study aid, not a giveaway. -->
          <div class="prompt-country-flag"><Flag country={question.answer} /></div>
        {/if}
        {#if cfg.mode === 'flag-to-country'}
          <div class="prompt-flag"><Flag country={question.answer} /></div>
          <p class="ask">{$t('play.prompt.whichCountry')}</p>
        {:else if cfg.mode === 'country-to-flag'}
          <p class="prompt-name">{$localizedName(question.answer)}</p>
          <p class="ask">{$t('play.prompt.whichFlag')}</p>
        {:else if cfg.mode === 'map-highlight'}
          <p class="ask">{$t('play.prompt.whichHighlighted')}</p>
        {:else if cfg.mode === 'capital-to-country'}
          <p class="prompt-name">{$localizedText(question.answer.capital)}</p>
          <p class="ask">{$t('play.prompt.whichCountryOfCapital')}</p>
        {:else if cfg.mode === 'country-to-capital'}
          <p class="prompt-name">{$localizedName(question.answer)}</p>
          <p class="ask">{$t('play.prompt.whichCapital')}</p>
        {:else if cfg.mode === 'country-to-languages'}
          <p class="prompt-name">{$localizedName(question.answer)}</p>
          <p class="ask">
            {$t('play.prompt.whichLanguages', {
              count: question.correctOptionIds?.length ?? 0,
            })}
          </p>
        {:else if cfg.mode === 'country-to-industry'}
          <p class="prompt-name">{$localizedName(question.answer)}</p>
          <p class="ask">{$t('play.prompt.whichIndustry')}</p>
        {:else}
          <p class="prompt-name">{$localizedName(question.answer)}</p>
          <p class="ask">{$t('play.prompt.locate')}</p>
        {/if}
      </div>

      {#if isMapMode(cfg.mode)}
        <!-- On phones the map is the primary surface but the content column is narrow, so the
             board bleeds out to the screen edges (see `.board`) for a meaningfully bigger map. -->
        <div class="board">
          {#if MapBoard}
            <!-- On a wrong map-locate answer, resolve the country the player actually clicked
                 so the board can label it (and the feedback can name it below). -->
            {@const pickedWrong =
              cfg.mode === 'map-locate' && answered && view.feedback && !view.feedback.correct
                ? getCountry(view.feedback.pickedIso ?? '')
                : undefined}
            <MapBoard
              highlightIso={cfg.mode === 'map-highlight' ? question.answer.iso2 : null}
              interactive={cfg.mode === 'map-locate'}
              disabled={answered}
              pickedIso={cfg.mode === 'map-locate' ? (view.feedback?.pickedIso ?? null) : null}
              pickedLabel={pickedWrong && pickedWrong.iso2 !== question.answer.iso2
                ? $localizedName(pickedWrong)
                : null}
              revealIso={cfg.mode === 'map-locate' && answered ? question.answer.iso2 : null}
              revealLabel={cfg.mode === 'map-locate' && answered
                ? $localizedName(question.answer)
                : null}
              focusIsos={mapFocusIsos(cfg)}
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

      {#if question.options}
        {@const countryOptions = question.options.map((c) => ({
          id: c.iso2,
          label: $localizedName(c),
          country: c,
        }))}
        <ChoiceGrid
          options={countryOptions}
          variant={cfg.mode === 'country-to-flag'
            ? 'flag'
            : cfg.mode === 'map-highlight'
              ? 'name-flag'
              : 'name'}
          {answered}
          correctId={question.answer.iso2}
          pickedId={view.feedback?.pickedIso ?? null}
          onpick={onPick}
        />
      {:else if question.attributeOptions}
        {@const attrOptions = question.attributeOptions.map((o) => ({
          id: o.id,
          label: $localizedText(o.label),
        }))}
        {#if isMultiSelectMode(cfg.mode)}
          <ChoiceGrid
            options={attrOptions}
            variant="name"
            multiSelect
            {answered}
            selectedIds={answered ? (view.feedback?.pickedIds ?? []) : selected}
            correctIds={question.correctOptionIds ?? null}
            onpick={toggleSelect}
          />
          {#if !answered}
            <button
              type="button"
              class="submit-multi"
              disabled={selected.length === 0}
              onclick={submitMulti}
            >
              {$t('play.multi.submit', { count: selected.length })}
            </button>
          {/if}
        {:else}
          <ChoiceGrid
            options={attrOptions}
            variant="name"
            {answered}
            correctId={question.correctOptionId ?? null}
            pickedId={view.feedback?.pickedIso ?? null}
            onpick={onPick}
          />
        {/if}
      {/if}

      {#if answered && view.feedback}
        {@const fb = view.feedback}
        <div class="feedback" class:correct={fb.correct} class:wrong={!fb.correct} role="status">
          <p class="verdict">
            {fb.correct ? $t('play.feedback.correct') : $t('play.feedback.wrong')}
          </p>
          {#if fb.question.mode === 'country-to-industry'}
            <!-- Industries always list the country's full set — on a correct answer too, so
                 the player learns the others they weren't shown, not just the one they picked. -->
            <p class="reveal">
              {$t('play.feedback.revealIndustries', {
                country: $localizedName(fb.question.answer),
                industries: fb.question.answer.industries
                  .map((i) => $localizedText(i.name))
                  .join(', '),
              })}
            </p>
            <!-- Phase 32: on a wrong answer, explain *why* the correct industry is one the
                 country is known for. Shown only when a curated fact exists for that pairing. -->
            {#if !fb.correct}
              {@const correctIndustry = fb.question.answer.industries.find(
                (i) => i.key === fb.question.correctOptionId,
              )}
              {#if correctIndustry?.fact}
                <p class="did-you-know">
                  <span class="dyk-icon" aria-hidden="true">💡</span>
                  <span>
                    <span class="dyk-label">{$t('play.feedback.didYouKnow')}</span>
                    {$localizedText(correctIndustry.fact)}
                  </span>
                </p>
              {/if}
            {/if}
          {:else if !fb.correct}
            {#if fb.question.mode === 'country-to-languages'}
              <p class="reveal">
                {$t('play.feedback.revealLanguages', {
                  country: $localizedName(fb.question.answer),
                  languages: fb.question.answer.languages
                    .map((l) => $localizedText(l.name))
                    .join(', '),
                })}
              </p>
            {:else}
              <!-- map-locate: name the country the player actually clicked, so a wrong
                   answer says what was selected (echoed by the red on-map label). -->
              {#if fb.question.mode === 'map-locate' && fb.pickedIso && fb.pickedIso !== fb.question.answer.iso2}
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
                {#if REVEAL_FLAG_MODES.includes(fb.question.mode)}
                  <span class="reveal-flag"><Flag country={fb.question.answer} /></span>
                {/if}
                <p class="reveal">
                  {$t('play.feedback.reveal', {
                    country:
                      fb.question.mode === 'country-to-capital'
                        ? $localizedText(fb.question.answer.capital)
                        : $localizedName(fb.question.answer),
                  })}
                </p>
              </div>
            {/if}
          {/if}
          <div class="countdown" style="--countdown-ms: {dwellMs(fb)}ms" aria-hidden="true">
            <div class="countdown-fill"></div>
          </div>
        </div>
      {/if}
    </section>
  {/if}
{/if}

<style>
  /* Setup */
  .setup {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    /* Focused screen (Phase 34): a centred column on desktop, never full-bleed. */
    max-width: 720px;
    margin-inline: auto;
    width: 100%;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .legend {
    font-weight: 600;
    color: var(--color-muted);
  }

  /* Mode families (Phase 35 category-first picker): a 2×2 grid of emblem cards. */
  .cat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .cat-card {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.85rem 1rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    text-align: left;
    box-shadow: var(--shadow-card);
    transition:
      transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1),
      border-color 0.12s ease,
      background 0.12s ease,
      box-shadow 0.12s ease;
  }

  .cat-chip {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 10px;
    border-radius: 13px;
    color: #fff;
  }

  .cat-card.map .cat-chip {
    background: var(--color-accent);
  }
  .cat-card.flags .cat-chip {
    background: var(--color-coral);
  }
  .cat-card.capitals .cat-chip {
    background: var(--color-sun);
  }
  .cat-card.extra .cat-chip {
    background: var(--color-violet);
  }

  .cat-text {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
    min-width: 0;
  }

  .cat-name {
    font-weight: 800;
  }

  .cat-hint {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-muted);
  }

  .cat-card:hover {
    border-color: var(--color-accent);
    transform: translateY(-2px);
  }

  .cat-card.selected {
    border-color: var(--color-accent);
    background: var(--color-accent-weak);
    box-shadow: var(--ring-selected);
  }

  /* Direction sub-choice tray for the selected family. */
  .dir-tray {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.15rem;
    padding: 0.75rem;
    background: var(--color-accent-weak);
    border-radius: var(--radius);
    animation: tray-in 0.18s ease;
  }

  @keyframes tray-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .dir-legend {
    padding-left: 0.15rem;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-accent-strong);
  }

  .dir-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }

  /* A selected direction card sits on the tinted tray, so it flips to white (not the
     accent-weak fill used elsewhere) to stay legible against the tray. */
  .dir-tray .opt.selected {
    background: var(--color-surface);
  }

  /* Format cards (Fixed / Survival / Grand Tour) — three across, stacking when narrow. */
  .format-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }

  .opt {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.9rem 1rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    font-weight: 600;
    text-align: left;
    box-shadow: var(--shadow-card);
    transition:
      transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1),
      border-color 0.12s ease,
      background 0.12s ease,
      box-shadow 0.12s ease;
  }

  .opt-title {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .opt small {
    font-weight: 400;
    color: var(--color-muted);
  }

  /* Mode cards carry a leading glyph beside the label. */
  .mode-opt {
    flex-direction: row;
    align-items: center;
    gap: 0.65rem;
  }

  .mode-opt :global(.mode-icon) {
    color: var(--color-muted);
    transition: color 0.12s ease;
  }

  .mode-opt.selected :global(.mode-icon) {
    color: var(--color-accent);
  }

  .region-selects {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .region-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
    gap: 0.6rem;
  }

  .region-opt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 0.7rem 0.5rem 0.6rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-muted);
    font-weight: 600;
    text-align: center;
    box-shadow: var(--shadow-card);
    transition:
      transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1),
      border-color 0.12s ease,
      color 0.12s ease,
      background 0.12s ease,
      box-shadow 0.12s ease;
  }

  .region-ico {
    display: block;
    width: 3.75rem;
    height: 3.75rem;
    color: var(--color-muted);
    transition: color 0.12s ease;
  }

  .region-label {
    font-size: 0.8rem;
    line-height: 1.2;
    color: var(--color-text);
  }

  .region-opt:hover {
    border-color: var(--color-accent);
    transform: translateY(-2px);
  }

  .region-opt.selected {
    border-color: var(--color-accent);
    background: var(--color-accent-weak);
    box-shadow: var(--ring-selected);
  }

  .region-opt.selected .region-ico,
  .region-opt.selected .region-label {
    color: var(--color-accent);
  }

  .pool-hint {
    color: var(--color-muted);
  }

  .opt:hover {
    border-color: var(--color-accent);
    transform: translateY(-2px);
  }

  .opt.selected {
    border-color: var(--color-accent);
    background: var(--color-accent-weak);
    box-shadow: var(--ring-selected);
  }

  .start {
    align-self: flex-start;
    padding: 0.7rem 1.8rem;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border: 0;
    border-radius: 999px;
    font-weight: 800;
    box-shadow: var(--shadow-chunky);
    transition:
      transform 0.12s ease,
      box-shadow 0.12s ease;
  }

  .start:hover {
    transform: translateY(-2px);
  }

  .start:active {
    transform: translateY(2px);
    box-shadow: var(--shadow-chunky-press);
  }

  /* Discreet secondary entry into the targeted-practice builder. */
  .practice-link {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: -0.6rem;
    color: var(--color-muted);
    font-weight: 700;
    font-size: 0.9rem;
    text-decoration: none;
    transition: color 0.12s ease;
  }

  .practice-link:hover {
    color: var(--color-accent);
    text-decoration: underline;
  }

  /* Multi-select submit (country-to-languages) */
  .submit-multi {
    align-self: center;
    margin-top: 0.25rem;
    padding: 0.65rem 2rem;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border: 0;
    border-radius: 999px;
    font-weight: 800;
    box-shadow: var(--shadow-chunky);
    transition:
      transform 0.12s ease,
      box-shadow 0.12s ease,
      opacity 0.12s ease;
  }

  .submit-multi:not(:disabled):hover {
    transform: translateY(-2px);
  }

  .submit-multi:not(:disabled):active {
    transform: translateY(2px);
    box-shadow: var(--shadow-chunky-press);
  }

  .submit-multi:disabled {
    opacity: 0.5;
  }

  /* Game */
  .game {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    /* The live board stays a focused, centred column — the map/choices never stretch wide. */
    max-width: 640px;
    margin-inline: auto;
    width: 100%;
  }

  .hud {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
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
  }

  .lives {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--color-wrong);
  }

  .heart {
    width: 1.6rem;
    height: 1.6rem;
    fill: currentColor;
    filter: drop-shadow(0 1px 1px rgb(0 0 0 / 12%));
    transition:
      transform 0.2s ease,
      color 0.2s ease;
  }

  .heart.lost {
    color: var(--color-border);
    filter: none;
    transform: scale(0.82);
  }

  .lives .mastered {
    margin-left: 0.5rem;
    font-size: 0.9rem;
    color: var(--color-muted);
  }

  .score {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.9rem;
    color: var(--color-muted);
  }

  .streak {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--color-accent);
    font-weight: 700;
    animation: streak-pop 0.34s ease;
  }

  @keyframes streak-pop {
    0% {
      transform: scale(0.7);
      opacity: 0;
    }
    60% {
      transform: scale(1.12);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* Milestone pop (Phase 39; escalated Phase 42): a tier-driven scale-bump + heat flash + glow,
     replayed only when the streak reaches a milestone (more specific than `.streak`, so it supersedes
     the base pop). The `--ms-*` custom properties are set inline per tier from `streakBurstSpec`, so
     the flame grows bigger, brighter and hotter the further the streak climbs — in step with the
     jingle. Values fall back to the original tier-0 feel if the vars are ever absent. */
  .streak.at-milestone {
    animation: streak-milestone var(--ms-dur, 0.45s) cubic-bezier(0.2, 0.9, 0.3, 1);
  }

  @keyframes streak-milestone {
    0% {
      transform: scale(1);
      color: var(--color-accent);
      filter: brightness(1);
    }
    32% {
      transform: scale(var(--ms-scale, 1.35));
      color: var(--ms-heat, var(--color-accent));
      filter: brightness(var(--ms-bright, 1.7))
        drop-shadow(0 0 var(--ms-glow, 6px) var(--ms-heat, var(--color-accent)));
    }
    100% {
      transform: scale(1);
      color: var(--color-accent);
      filter: brightness(1);
    }
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

  .prompt-flag {
    width: 100%;
    max-width: 260px;
  }

  /* Smaller anchor flag above the country name in capital/language/industry prompts. */
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

  /* "You picked …" (wrong map-locate): tinted the "wrong" red to match the red on-map
     label of the clicked country, and to read as the mistake vs. the green correct reveal. */
  .picked-pick .reveal {
    color: var(--color-wrong);
  }

  /* Phase 32: "Did you know?" fun-fact callout on a wrong industries answer. A calm turquoise
     card so the learning moment reads apart from the red "wrong" state around it. */
  .did-you-know {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin: 0;
    padding: 0.6rem 0.8rem;
    text-align: left;
    background: var(--color-accent-weak);
    border-radius: var(--radius);
    color: var(--color-text);
    line-height: 1.4;
  }

  .dyk-icon {
    flex: 0 0 auto;
    font-size: 1.1rem;
    line-height: 1.4;
  }

  .dyk-label {
    font-weight: 700;
    color: var(--color-accent-strong);
    margin-right: 0.15rem;
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

  @media (prefers-reduced-motion: reduce) {
    .countdown-fill,
    .feedback,
    .streak,
    .streak.at-milestone,
    .dir-tray {
      animation: none;
    }

    .opt,
    .cat-card,
    .region-opt,
    .start,
    .heart {
      transition: none;
    }

    .opt:hover,
    .cat-card:hover,
    .region-opt:hover,
    .start:hover {
      transform: none;
    }
  }

  @media (max-width: 560px) {
    .format-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 480px) {
    .cat-grid,
    .dir-row {
      grid-template-columns: 1fr;
    }
  }

  /* The map is the primary surface, but on a phone the content column is narrow (and further
     inset by the content's 1rem side padding), so the map ends up small. Let the board bleed
     out to the screen edges there — canceling that padding — for a noticeably bigger map,
     without touching the projection (which stays memoized at its fixed 980×500 viewBox).
     Desktop keeps the framed, centred column. */
  @media (max-width: 640px) {
    .board {
      margin-inline: -1rem;
    }
  }
</style>
