<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { get } from 'svelte/store';
  import { push } from 'svelte-spa-router';
  import { t, localizedName, localizedText, localizedRegion } from '../../i18n';
  import {
    hasOptions,
    isMapMode,
    isMultiSelectMode,
    BLITZ_START_SECONDS,
    BLITZ_CAP_SECONDS,
    blitzCombo,
    blitzComboStreak,
    blitzComboState,
    blitzRemainingMs,
    computeBlitzPoints,
    computeBlitzBest,
    computeBlitzSetBest,
    blitzAllows,
    type GameMode,
    type QuestionResult,
    type RegionFilter,
    type SessionType,
  } from '../../domain';
  import {
    countryCount,
    getCountries,
    getCountry,
    getRegionTree,
    type Prefs,
    type RegionNode,
    type SessionRecord,
  } from '../../data';
  import {
    play,
    lastSummary,
    lastBlitzResult,
    lastRunConfig,
    pendingConfig,
    playFabAction,
    focusIsosForConfig,
    type RunConfig,
  } from '../stores/game';
  import {
    prefs,
    updatePrefs,
    saveSession,
    saveDailyResult,
    recordAnswer,
    loadSessions,
    storageReady,
  } from '../stores/persistence';
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
  // Blitz (Phase 42, OQ5) advances near-instantly — just long enough to register the
  // verdict colour — so the clock, not the reveal, sets the pace.
  const BLITZ_DWELL_MS = 350;

  // Heat ramp for the Blitz multiplier badge — one colour per tier (x1..x5), warming from the cool
  // teal accent through gold to a hot coral at the top, echoing the streak-flame heat ramp so the
  // two celebrations feel of a piece. Indexed by (multiplier - 1); see `blitzComboStyle`.
  const BLITZ_COMBO_HEAT = ['#10a5a0', '#25c2b0', '#ffb020', '#ff8a3d', '#ff5c48'];

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

  // Blitz's allowed modes (the five quick-tap directions) and the `blitzAllows` gate now live in the
  // domain (`blitz.ts`), shared with the targeted-practice picker so both offer Blitz on the same set.

  // The families/directions offered by the current format. Blitz trims each family to its
  // allowed modes and drops families left empty (so "extra" disappears and the map family shows
  // only "highlight"); every other format offers the full set.
  const visibleGroups = $derived(
    type === 'blitz'
      ? MODE_GROUPS.map((g) => ({
          ...g,
          modes: g.modes.filter((m) => blitzAllows(m.mode)),
        })).filter((g) => g.modes.length > 0)
      : MODE_GROUPS,
  );

  // The family whose direction modes are shown in the tray. Falls back defensively to the first.
  const activeGroup = $derived(visibleGroups.find((g) => g.key === category) ?? visibleGroups[0]);

  // Selecting a family shows its directions; if the current `mode` doesn't belong to the new
  // family (or isn't allowed by the current format), land on that family's first *visible*
  // direction so `mode` is always valid and in-scope.
  function selectCategory(key: ModeGroup): void {
    category = key;
    const group = visibleGroups.find((g) => g.key === key);
    if (group && !group.modes.some((m) => m.mode === mode)) {
      mode = group.modes[0].mode;
    }
  }

  // Choosing a format. Switching to Blitz while on an excluded mode snaps back to the default
  // Flags → "Flag → Country" (always allowed), so the picker never shows a mode Blitz can't run.
  function selectType(next: SessionType): void {
    type = next;
    if (next === 'blitz' && !blitzAllows(mode)) {
      category = 'flags';
      mode = 'flag-to-country';
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

  // Personal best for the Blitz card (Phase 42): the top score for the current mode × region
  // (× sub-region) slot, derived from history. Loaded once storage is ready; recomputed as the
  // selection changes. 0 until a first run exists — the card then shows the generic hint.
  let blitzSessions = $state<SessionRecord[]>([]);
  $effect(() => {
    if ($storageReady) void loadSessions().then((s) => (blitzSessions = s));
  });
  const blitzBest = $derived(
    computeBlitzBest(blitzSessions, {
      mode,
      region: selectedRegion || undefined,
      subregion: selectedSubregion || undefined,
    }),
  );

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

  // Remember-my-setup: persist the current setup selections whenever a run is launched *from this
  // screen* (desktop Start / mobile FAB) so the next visit re-opens on the same mode / direction /
  // format / region. Stored as primitives (region as a plain string), never the pending-config path
  // (Retry / recommendations), so `lastSetup` only ever holds a real setup-screen choice.
  function rememberSetup(): void {
    updatePrefs({
      lastSetup: {
        mode,
        type,
        ...(selectedRegion ? { region: selectedRegion } : {}),
        ...(selectedSubregion ? { subregion: selectedSubregion } : {}),
      },
    });
  }

  /**
   * Restore a persisted {@link Prefs.lastSetup} into the setup selections, re-validating it against
   * the live dataset so stale data can't select something gone: an unknown mode aborts the restore
   * (keep defaults); an unknown region / sub-region falls back to World / whole-region; a non-setup
   * format falls back to Fixed; and a Blitz format re-snaps a mode Blitz can't run, exactly like
   * {@link selectType}. Pure of storage — the caller passes the already-loaded value.
   */
  function applyLastSetup(s: Prefs['lastSetup']): void {
    if (!s) return;
    const group = MODE_GROUPS.find((g) => g.modes.some((m) => m.mode === s.mode));
    if (!group) return; // mode no longer exists — leave the defaults untouched

    const region = s.region && regionTree.some((r) => r.region === s.region) ? s.region : '';
    const node = region ? regionTree.find((r) => r.region === region) : null;
    const subregion =
      region && s.subregion && node?.subregions.some((sr) => sr.subregion === s.subregion)
        ? s.subregion
        : '';
    const SETUP_TYPES: readonly SessionType[] = ['fixed', 'survival', 'full', 'blitz'];
    const nextType: SessionType = SETUP_TYPES.includes(s.type) ? s.type : 'fixed';

    category = group.key;
    mode = s.mode;
    selectedRegion = region;
    selectedSubregion = subregion;
    if (nextType === 'blitz' && !blitzAllows(mode)) {
      category = 'flags';
      mode = 'flag-to-country';
    }
    type = nextType;
  }

  // Pre-select the setup last launched from here, once, as soon as storage is ready — but only while
  // the setup screen is actually showing (`idle`), so it never clobbers a pending Retry/recommendation
  // auto-start or an in-progress run. A returning visit remounts this route, re-arming the one-shot.
  let setupRestored = false;
  $effect(() => {
    if (!$storageReady || setupRestored) return;
    setupRestored = true;
    if (get(play).status === 'idle') applyLastSetup(get(prefs).lastSetup);
  });

  /** The run config for the current setup selections (mode / type / region / prefs). */
  function buildRunConfig(): RunConfig {
    const filter: RegionFilter | undefined = selectedRegion
      ? { region: selectedRegion, ...(selectedSubregion ? { subregion: selectedSubregion } : {}) }
      : undefined;
    const p = $prefs;
    return {
      mode,
      type,
      filter,
      fixedLength: p.fixedLength,
      lives: p.survivalLives,
      choices: p.choicesPerQuestion,
    };
  }

  // Desktop keeps the plain "Start" button: an immediate launch, no flourish.
  function startGame(): void {
    rememberSetup();
    play.start(buildRunConfig());
  }

  // Mobile launch (Phase 43): the bottom-bar Play FAB stands in for the removed "Start" button
  // on the setup screen. Pressing it plays a short "launch" flourish — a teal disc wiping up from
  // the FAB — and then starts the game with the *current* selections. Purely a mobile replacement
  // for Start; the config is identical. Reduced motion (OS or the in-app toggle) skips straight to
  // the game with no veil. `pendingCfg` is captured up-front so mid-animation selection changes
  // can't affect the run that was launched.
  let launching = $state(false);
  let launchPhase = $state<'expand' | 'reveal'>('expand');
  let pendingCfg: RunConfig | null = null;

  function triggerStart(): void {
    if (launching) return;
    rememberSetup();
    const cfg = buildRunConfig();
    if ($prefs.reduceMotion || reducedMotionQuery?.matches) {
      play.start(cfg);
      return;
    }
    pendingCfg = cfg;
    launchPhase = 'expand';
    launching = true;
  }

  // Drive the two-step veil: once it has wiped over the screen, start the game underneath, then
  // fade the veil away to reveal it. Ignore the inner badge's own animation (it bubbles here).
  function onVeilAnimEnd(e: AnimationEvent): void {
    if (e.target !== e.currentTarget) return;
    if (launchPhase === 'expand') {
      if (pendingCfg) play.start(pendingCfg);
      pendingCfg = null;
      launchPhase = 'reveal';
    } else {
      launching = false;
    }
  }

  // Publish the launch action for the nav FAB while (and only while) the setup screen is showing;
  // clearing it returns the FAB to being an ordinary link (see Nav.svelte / game.ts).
  $effect(() => {
    if ($play.status === 'idle') {
      playFabAction.set(triggerStart);
      return () => playFabAction.set(null);
    }
  });

  // Feed an answer to spaced-repetition — **except in Blitz** (Phase 42, owner decision): Blitz is
  // a pure score format, fully decoupled from the learning model, so a mistap under time pressure
  // can't demote a country's mastery (and fast correct taps can't inflate it). Every other format
  // records each answer to SR as usual.
  function recordSR(result: QuestionResult | null): void {
    if (result && get(play).config?.type !== 'blitz') void recordAnswer(result);
  }

  function onPick(id: string): void {
    recordSR(play.answer(id));
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
    recordSR(play.answer([...selected]));
  }

  // map-locate: the map is the answer surface. `play.answer` no-ops once the current
  // question is graded, so a stray click after answering is harmless.
  function onMapPick(iso2: string): void {
    recordSR(play.answer(iso2));
  }

  function onContinue(): void {
    const finished = play.advance();
    if (finished) {
      const summary = play.summary();
      lastSummary.set(summary);
      lastRunConfig.set(get(play).config ?? null); // hand the run's config to the Summary duel gate
      lastBlitzResult.set(null); // a normal finish clears any prior blitz result
      if (summary) {
        // Carry the saved-set id (if any) onto the record so a set's runs are attributable to it.
        void saveSession(summary, get(play).config?.setId);
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
    // Blitz races on: a near-instant dwell (just the verdict flash), the clock never pausing.
    const ms = $play.config?.type === 'blitz' ? BLITZ_DWELL_MS : dwellMs($play.feedback);
    const id = setTimeout(onContinue, ms);
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
    // Blitz has its own voice (this task): the per-answer cue escalates with the *combo multiplier*,
    // not the streak milestones — so it stays snappy and decoupled from the learning-mode celebration.
    // The level uses the time-aware combo streak (results now include this answer), so a slow-but-
    // correct tap plays the x1 cue, matching its reset. No milestone pulse/burst here — the badge does.
    if ($play.config?.type === 'blitz') {
      const comboStreak = blitzComboStreak($play.state?.results ?? []);
      sound.play('blitz', { level: blitzCombo(comboStreak) - 1 });
      return;
    }
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

  // ---- Blitz clock (Phase 42) --------------------------------------------------------------
  // The countdown is UI-owned — the domain stays clock-free. Drive it off `performance.now()`
  // deltas, let the live correct-count climb the deadline (+1 s each, capped at 90 s), and call
  // `play.endBlitz()` at zero. `blitzStart`/`blitzNow` feed the reactive time bar; the interval
  // also fires the final-seconds tick and detects the end.
  let blitzStart = $state(0);
  let blitzNow = $state(0);
  // When the *current* Blitz question was presented (perf.now), so the combo can expire if the
  // player dawdles on it. Reset per question by the effect below; 0 while no question is timing.
  let blitzQStart = $state(0);

  const blitzActive = $derived(
    $play.config?.type === 'blitz' && ($play.status === 'playing' || $play.status === 'answered'),
  );
  // Live values for the HUD: the running points total and the current combo multiplier.
  const blitzPoints = $derived(
    $play.config?.type === 'blitz' ? computeBlitzPoints($play.state?.results ?? []) : 0,
  );
  // Live, time-aware combo. `blitzComboStreakVal` is the committed streak (the combo you've banked);
  // while a question sits unanswered it *decays a tier per reaction window* (`blitzComboState`),
  // down to x1 — so the badge visibly ticks down if the player hesitates, matching how a slow answer
  // scores. During the answered dwell the committed combo shows (the just-answered result is folded in).
  const blitzComboStreakVal = $derived(blitzComboStreak($play.state?.results ?? []));
  const blitzQElapsed = $derived(
    blitzActive && $play.status === 'playing' && blitzQStart > 0
      ? Math.max(0, blitzNow - blitzQStart)
      : 0,
  );
  // The live combo state in one pass: the decayed multiplier, the current tier's window and the time
  // left in it. Windows now *shorten with the tier* (`BLITZ_TIER_WINDOWS_MS`), so this cumulative walk
  // (`blitzComboState`) replaces the old uniform modulo — the badge and meter read the same source.
  const blitzComboLive = $derived.by(() => {
    const committed = blitzCombo(blitzComboStreakVal);
    return $play.config?.type === 'blitz' && $play.status === 'playing'
      ? blitzComboState(committed, blitzQElapsed)
      : { combo: committed, windowMs: 0, remainingMs: 0 };
  });
  const blitzComboMult = $derived(blitzComboLive.combo);

  // Combo "reaction meter" (owner request): a reverse progress bar under the badge showing the timer
  // for the *current* tier. It drains over that tier's window then refills as a tier is lost — faster
  // at high multipliers, slower at low ones — repeating down to x1; hidden once there's no tier left
  // to lose. `blitzNow` ticks it (~100 ms, eased by a short CSS transition); it turns urgent near empty.
  const showComboTimer = $derived(blitzComboMult > 1 && $play.status === 'playing');
  const comboTimeLeftPct = $derived.by(() => {
    const { windowMs, remainingMs } = blitzComboLive;
    if (!showComboTimer || windowMs <= 0) return 100;
    return Math.max(0, Math.min(100, (remainingMs / windowMs) * 100));
  });

  // The Blitz multiplier badge (this task) is the run's centrepiece now the streak pill is hidden —
  // so it *escalates* with the combo. Each tier warms the badge along a heat ramp (teal → gold →
  // coral, echoing the streak flame) and grows its glow and pop overshoot. Heat is indexed by
  // (multiplier - 1); `hot` (x2+) flips the badge from an outlined "base" to a filled, glowing pill.
  const blitzComboStyle = $derived.by(() => {
    const m = blitzComboMult; // 1..5
    const i = m - 1; // 0-based tier
    return {
      mult: m,
      heat: BLITZ_COMBO_HEAT[i] ?? BLITZ_COMBO_HEAT[0],
      glow: 6 + i * 5, // 6 → 26 px
      peak: 1.14 + i * 0.05, // pop overshoot grows a touch per tier
      hot: m > 1,
    };
  });
  // Bump a pulse only when the multiplier *steps up*, so the badge replays its celebratory pop on a
  // climb but not when a miss quietly resets it to x1. `prevCombo` is a plain local (untracked); the
  // pulse read is untracked so writing it here can't self-invalidate the effect.
  let comboPulse = $state(0);
  let prevCombo = 1;
  $effect(() => {
    const m = blitzComboMult;
    if (m > prevCombo) comboPulse = untrack(() => comboPulse) + 1;
    prevCombo = m;
  });

  const blitzRemaining = $derived(
    blitzActive ? blitzRemainingMs(blitzNow - blitzStart, $play.state?.correct ?? 0) : 0,
  );
  const blitzRemainingSec = $derived(Math.max(0, Math.ceil(blitzRemaining / 1000)));

  // Restart the per-question combo timer whenever a fresh Blitz question is presented, so
  // `comboExpired` measures each question's own reaction time. Blitz-only; a no-op elsewhere.
  $effect(() => {
    if ($play.config?.type !== 'blitz') return;
    const key = $play.status === 'playing' ? ($play.question?.itemKey ?? null) : null;
    if (key) blitzQStart = performance.now();
  });

  // Run the clock while a blitz session is live — across both `playing` and `answered`, so it
  // never pauses on the reveal. `blitzActive` stays true through question↔reveal transitions, so
  // this effect starts once at run start and tears down at finish (one interval per run).
  $effect(() => {
    if (!blitzActive) return;
    const start = performance.now();
    blitzStart = start;
    blitzNow = start;
    let lastWhole = Number.POSITIVE_INFINITY;
    const id = setInterval(() => {
      const now = performance.now();
      blitzNow = now;
      const correct = get(play).state?.correct ?? 0;
      const remaining = blitzRemainingMs(now - start, correct);
      // A soft heartbeat once per whole second crossed in the final five (never a nag).
      const whole = Math.ceil(remaining / 1000);
      if (whole < lastWhole && whole >= 1 && whole <= 5) sound.play('tick');
      lastWhole = whole;
      if (remaining <= 0) {
        clearInterval(id);
        endBlitzRun();
      }
    }, 100);
    return () => clearInterval(id);
  });

  // End a blitz run: stop the engine, score it against the previous best (history here still
  // excludes this run — it isn't saved yet), stash the result for the Summary, persist, and route.
  function endBlitzRun(): void {
    if (get(play).status === 'finished') return;
    play.endBlitz();
    const summary = play.summary();
    lastSummary.set(summary);
    lastRunConfig.set(get(play).config ?? null); // hand the run's config to the Summary duel gate
    if (!summary) {
      push('/summary');
      return;
    }
    const points = computeBlitzPoints(summary.results);
    // Which "best" this run counts toward depends on where it was played:
    //  • a saved custom set → its own per-set best ("beat your best on this set"),
    //  • an ad-hoc custom set → no best (just show the score; `best: null`),
    //  • a region / World run → the region/World slot best (the original Phase-42 path).
    const cfg = get(play).config;
    const setId = cfg?.setId;
    const isTargeted = !!(cfg?.answerPoolIso && cfg.answerPoolIso.length);
    let best: number | null;
    let isNewBest: boolean;
    if (isTargeted && !setId) {
      best = null; // ad-hoc set: no personal best tracked
      isNewBest = false;
    } else {
      const prevBest = setId
        ? computeBlitzSetBest(blitzSessions, { mode: summary.mode, setId })
        : computeBlitzBest(blitzSessions, {
            mode: summary.mode,
            region: summary.regionFilter?.region,
            subregion: summary.regionFilter?.subregion,
          });
      isNewBest = points > 0 && points > prevBest;
      best = Math.max(points, prevBest);
    }
    lastBlitzResult.set({ points, best, isNewBest });
    void saveSession(summary, setId);
    // Time's-up cue now; the celebratory jingle a beat later so the two don't muddy each other.
    sound.play('timesup');
    setTimeout(() => sound.play(isNewBest ? 'perfect' : 'finish'), 700);
    push('/summary');
  }

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

<!-- Mobile launch flourish (Phase 43): a teal disc that wipes up from the Play FAB, hands over to
     the game beneath, then fades. Fixed + top-most, so its place in the tree is immaterial; it
     lives outside the setup/game branches so it survives the swap between them. -->
{#if launching}
  <div class="launch-veil {launchPhase}" aria-hidden="true" onanimationend={onVeilAnimEnd}>
    <span class="launch-badge"><Icon name="play" size={40} /></span>
  </div>
{/if}

{#if $play.status === 'idle'}
  <section class="setup">
    <PageHero title={$t('play.title')} pose="wave" />

    <div class="field">
      <span class="legend" id="mode-legend">{$t('play.setup.chooseMode')}</span>

      <!-- Category-first (Phase 35): pick a family, then a direction. -->
      <div class="cat-grid" role="group" aria-labelledby="mode-legend">
        {#each visibleGroups as group (group.key)}
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
          onclick={() => selectType('fixed')}
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
          onclick={() => selectType('survival')}
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
          onclick={() => selectType('full')}
        >
          <span class="opt-title"><Icon name="globe" size="1.05em" /> {$t('sessionType.full')}</span
          >
          <small>{$t('play.setup.fullHint', { count: poolSize })}</small>
        </button>
        <!-- Blitz (Phase 42): a 60 s countdown (extending to a 90 s cap), points × combo, and a
             local personal best. Restricts the mode picker to the five quick-tap modes. -->
        <button
          type="button"
          class="opt fmt-blitz"
          class:selected={type === 'blitz'}
          aria-pressed={type === 'blitz'}
          onclick={() => selectType('blitz')}
        >
          <span class="opt-title"
            ><Icon name="flame" size="1.05em" /> {$t('sessionType.blitz')}</span
          >
          <small>{$t('play.setup.blitzHint', { seconds: BLITZ_START_SECONDS })}</small>
          {#if blitzBest > 0}
            <small class="blitz-best">
              {$t('play.setup.blitzBest', { points: blitzBest.toLocaleString() })}
            </small>
          {/if}
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
    <!-- The mode of the question on screen. Equals `cfg.mode` for an ordinary single-mode run, but a
         combined practice run interleaves both of a family's directions, so the prompt / board /
         choices key off the *question's* mode, not the session's. -->
    {@const qMode = question.mode}
    {@const total = cfg.fixedLength ?? $prefs.fixedLength}
    {@const lives = cfg.lives ?? $prefs.survivalLives}
    {@const answered = view.status === 'answered'}

    <section class="game">
      <!-- Game bar (single-line HUD): a leading ✕ quit, the run's live status in the middle (progress
           bar / survival hearts / blitz clock), and the score-side on the right. On mobile it takes
           the slot the brand app-bar vacates during a run (see App.svelte), so the question sits far
           higher than the old stacked HUD did. -->
      <header class="gamebar">
        <button
          type="button"
          class="gb-quit"
          onclick={quit}
          aria-label={$t('play.quit')}
          title={$t('play.quit')}
        >
          <Icon name="close" size="1.15em" />
        </button>

        <div class="gb-mid">
          {#if cfg.type === 'blitz'}
            <!-- Blitz clock (Phase 42): the track spans the full 90 s cap so its length *is* the
               ceiling; the fill is the time left, and a tick marks the 60 s starting line — fill
               to its right is banked bonus time. Turns urgent (`.low`) in the final five seconds. -->
            {@const capMs = BLITZ_CAP_SECONDS * 1000}
            {@const fillPct = Math.max(0, Math.min(100, (blitzRemaining / capMs) * 100))}
            {@const atCap = blitzRemaining >= capMs - 250}
            <div
              class="blitz-clock"
              class:low={blitzRemainingSec <= 5}
              role="timer"
              aria-label={$t('play.blitz.clockAria', {
                remaining: blitzRemainingSec,
                cap: BLITZ_CAP_SECONDS,
              })}
            >
              <div class="clock-head">
                <span class="clock-time">
                  <Icon name="clock" size="0.95em" />
                  {$t('play.blitz.timeLeft', { seconds: blitzRemainingSec })}
                </span>
                <span class="clock-cap">
                  {atCap
                    ? $t('play.blitz.max')
                    : $t('play.blitz.cap', { seconds: BLITZ_CAP_SECONDS })}
                </span>
              </div>
              <div class="clock-track">
                <div class="clock-fill" style="width:{fillPct}%"></div>
                <div
                  class="clock-startmark"
                  style="left:{(BLITZ_START_SECONDS / BLITZ_CAP_SECONDS) * 100}%"
                ></div>
              </div>
            </div>
          {:else if cfg.type !== 'survival'}
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
                  >{$t('play.progress.mastered', {
                    count: mastered,
                    total: view.answerCount,
                  })}</span
                >
              {/if}
            </div>
          {/if}
        </div>

        <div class="gb-right">
          {#if cfg.type === 'blitz'}
            <!-- Points are the headline in Blitz; the multiplier badge (always shown, since the
                 streak pill is hidden here) is the live combo — it heats up, glows and pops as the
                 multiplier climbs. Re-keyed on `comboPulse` so the pop replays only on a step-up. -->
            <span class="blitz-points"
              >{blitzPoints.toLocaleString()} <small>{$t('play.blitz.pts')}</small></span
            >
            {@const cs = blitzComboStyle}
            <span
              class="combo-wrap"
              style="--combo-heat:{cs.heat}; --combo-glow:{cs.glow}px; --combo-peak:{cs.peak}"
            >
              {#key comboPulse}
                <span class="blitz-combo" class:hot={cs.hot}>
                  <Icon name="flame" size="0.95em" />
                  <span class="combo-num">{$t('play.blitz.combo', { mult: cs.mult })}</span>
                </span>
              {/key}
              <!-- Reaction meter: a reverse bar that drains over the combo window; keeping it topped
                   up (answering fast) protects the combo, and it turns urgent as it empties. -->
              <span class="combo-timer" class:shown={showComboTimer} aria-hidden="true">
                <span
                  class="combo-timer-fill"
                  class:urgent={comboTimeLeftPct <= 40}
                  style="transform:scaleX({comboTimeLeftPct / 100})"
                ></span>
              </span>
            </span>
          {:else}
            <span>{$t('play.progress.score', { correct: s.correct, total: s.results.length })}</span
            >
          {/if}
          {#if s.streak > 1 && cfg.type !== 'blitz'}
            <!-- Non-Blitz only: Blitz hides the streak pill (redundant with the combo multiplier
                 badge above) and celebrates via that badge instead. Keyed on the milestone pulse so
                 the celebratory pop replays only when a new milestone is reached (`at-milestone`);
                 ordinary correct answers just update the count with the base appear-pop. At a
                 milestone the pill's heat/scale/glow escalates by tier via `streakBurstSpec`. -->
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
        </div>
      </header>

      <!-- Milestone burst overlay (Phase 42). Fixed-position, so its DOM location here is immaterial;
           `{#key burstKey}` remounts it on each milestone to replay the escalating one-shot burst. -->
      {#if burstTier >= 0}
        {#key burstKey}
          <StreakBurst tier={burstTier} x={burstX} y={burstY} />
        {/key}
      {/if}

      <div class="prompt" class:map-prompt={isMapMode(qMode)}>
        {#if PROMPT_FLAG_MODES.includes(qMode)}
          <!-- Anchor the country name with its flag (capitals / languages / industries):
               the answer is an attribute, so the flag is a study aid, not a giveaway. -->
          <div class="prompt-country-flag"><Flag country={question.answer} /></div>
        {/if}
        {#if qMode === 'flag-to-country'}
          <div class="prompt-flag"><Flag country={question.answer} /></div>
          <p class="ask">{$t('play.prompt.whichCountry')}</p>
        {:else if qMode === 'country-to-flag'}
          <p class="prompt-name">{$localizedName(question.answer)}</p>
          <p class="ask">{$t('play.prompt.whichFlag')}</p>
        {:else if qMode === 'map-highlight'}
          <p class="ask">{$t('play.prompt.whichHighlighted')}</p>
        {:else if qMode === 'capital-to-country'}
          <p class="prompt-name">{$localizedText(question.answer.capital)}</p>
          <p class="ask">{$t('play.prompt.whichCountryOfCapital')}</p>
        {:else if qMode === 'country-to-capital'}
          <p class="prompt-name">{$localizedName(question.answer)}</p>
          <p class="ask">{$t('play.prompt.whichCapital')}</p>
        {:else if qMode === 'country-to-languages'}
          <p class="prompt-name">{$localizedName(question.answer)}</p>
          <p class="ask">
            {$t('play.prompt.whichLanguages', {
              count: question.correctOptionIds?.length ?? 0,
            })}
          </p>
        {:else if qMode === 'country-to-industry'}
          <p class="prompt-name">{$localizedName(question.answer)}</p>
          <p class="ask">{$t('play.prompt.whichIndustry')}</p>
        {:else}
          <p class="prompt-name">{$localizedName(question.answer)}</p>
          <p class="ask">{$t('play.prompt.locate')}</p>
        {/if}
      </div>

      {#if isMapMode(qMode)}
        <!-- On phones the map is the primary surface but the content column is narrow, so the
             board bleeds out to the screen edges (see `.board`) for a meaningfully bigger map. -->
        <div class="board">
          {#if MapBoard}
            <!-- On a wrong map-locate answer, resolve the country the player actually clicked
                 so the board can label it (and the feedback can name it below). -->
            {@const pickedWrong =
              qMode === 'map-locate' && answered && view.feedback && !view.feedback.correct
                ? getCountry(view.feedback.pickedIso ?? '')
                : undefined}
            <MapBoard
              highlightIso={qMode === 'map-highlight' ? question.answer.iso2 : null}
              interactive={qMode === 'map-locate'}
              disabled={answered}
              pickedIso={qMode === 'map-locate' ? (view.feedback?.pickedIso ?? null) : null}
              pickedLabel={pickedWrong && pickedWrong.iso2 !== question.answer.iso2
                ? $localizedName(pickedWrong)
                : null}
              answerIso={qMode === 'map-locate' && !answered ? question.answer.iso2 : null}
              revealIso={qMode === 'map-locate' && answered ? question.answer.iso2 : null}
              revealLabel={qMode === 'map-locate' && answered
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
          variant={qMode === 'country-to-flag'
            ? 'flag'
            : qMode === 'map-highlight'
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
        {#if isMultiSelectMode(qMode)}
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
          {#if cfg.type !== 'blitz'}
            <div class="countdown" style="--countdown-ms: {dwellMs(fb)}ms" aria-hidden="true">
              <div class="countdown-fill"></div>
            </div>
          {/if}
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
    /* Four formats now (Phase 42): fit as many across as comfortably fit, wrapping to rows. */
    grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
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

  /* The Blitz personal best sits under the always-on "60 s" hint and reads as an achievement,
     not a hint — so it takes the accent colour and a touch more weight. */
  .opt small.blitz-best {
    color: var(--color-accent);
    font-weight: 600;
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

  /* Launch veil (Phase 43): full-screen teal, wiping up from the FAB (bottom-centre) via a
     clip-path circle, then fading to reveal the game. Above every other overlay. */
  .launch-veil {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    background: radial-gradient(
      130% 130% at 50% 100%,
      var(--color-accent) 0%,
      var(--color-accent-strong) 100%
    );
    color: var(--color-accent-contrast);
    will-change: clip-path, opacity;
  }

  .launch-veil.expand {
    animation: veil-expand 0.42s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  /* Hold full coverage while fading out (the game is now live beneath). */
  .launch-veil.reveal {
    clip-path: circle(150% at 50% 100%);
    animation: veil-fade 0.3s ease-out forwards;
  }

  @keyframes veil-expand {
    from {
      clip-path: circle(0% at 50% 100%);
    }
    to {
      clip-path: circle(150% at 50% 100%);
    }
  }

  @keyframes veil-fade {
    to {
      opacity: 0;
    }
  }

  .launch-badge {
    display: grid;
    place-items: center;
    width: 84px;
    height: 84px;
    border-radius: 50%;
    background: rgb(255 255 255 / 16%);
    animation: badge-pop 0.42s ease;
  }

  @keyframes badge-pop {
    0% {
      transform: scale(0.4);
      opacity: 0;
    }
    60% {
      transform: scale(1.1);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* On mobile (where the raised Play FAB is present) the FAB *is* the start control, so the
     in-page "Start" button is removed. Desktop — which has no FAB, only the rail link — keeps it. */
  @media (max-width: 859.98px) {
    .start {
      display: none;
    }
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

  /* Game bar: the single-line HUD strip. A leading ✕ quit, the run's live status filling the
     middle, and the score-side on the right. A rounded surface card on desktop; on mobile it
     breaks full-bleed to the top to stand in for the (hidden) brand app-bar. */
  .gamebar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.55rem 0.7rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .gb-quit {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 2.1rem;
    height: 2.1rem;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: transparent;
    color: var(--color-muted);
    transition:
      color 0.12s ease,
      border-color 0.12s ease,
      background 0.12s ease;
  }

  .gb-quit:hover {
    color: var(--color-wrong);
    border-color: var(--color-wrong);
    background: var(--color-wrong-bg);
  }

  /* The mid slot stretches to fill; its child (progress bar / hearts / blitz clock) already
     lays itself out, but is allowed to shrink below its natural min so the bar never wraps. */
  .gb-mid {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
  }

  .gb-mid .progress,
  .gb-mid .blitz-clock,
  .gb-mid .lives {
    flex: 1 1 auto;
    min-width: 0;
  }

  .gb-right {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.9rem;
    color: var(--color-muted);
  }

  /* Mobile: the game bar takes over the top slot the brand app-bar vacated during a run (see
     App.svelte), so it breaks out of the content padding to sit flush and full-bleed under the
     status bar — reclaiming the whole app-bar row plus the content's top padding. */
  @media (max-width: 859.98px) {
    .gamebar {
      margin: -1.25rem -1rem 0;
      padding: calc(0.5rem + env(safe-area-inset-top, 0px)) 1rem 0.5rem;
      border-width: 0 0 1px;
      border-radius: 0;
      box-shadow: none;
    }
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

  /* Blitz clock (Phase 42). The track spans the full 90 s cap; the fill is the time left, and a
     thin tick marks the 60 s starting line (fill to its right = banked bonus time). */
  .blitz-clock {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 12rem;
    flex: 1;
  }

  .clock-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .clock-time {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-weight: 800;
    font-size: 1.05rem;
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
    transition: color 0.2s ease;
  }

  .clock-cap {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--color-muted);
  }

  .clock-track {
    position: relative;
    height: 10px;
    background: var(--color-border);
    border-radius: 999px;
    overflow: hidden;
  }

  .clock-fill {
    height: 100%;
    background: var(--progress-gradient);
    border-radius: 999px;
    transition: width 0.15s linear;
  }

  /* The 60 s starting line — a slim segment divider cut into the bar, visible over fill or track. */
  .clock-startmark {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--color-surface);
    transform: translateX(-1.5px);
  }

  /* Final five seconds: the numeral and fill turn urgent and the fill breathes. The app-wide
     `:root[data-reduce-motion]` rule (and the OS query below) neutralise the pulse. */
  .blitz-clock.low .clock-time {
    color: var(--color-wrong);
  }

  .blitz-clock.low .clock-fill {
    background: var(--color-wrong);
    animation: blitz-pulse 1s ease-in-out infinite;
  }

  @keyframes blitz-pulse {
    50% {
      opacity: 0.5;
    }
  }

  /* Blitz score HUD: points headline + live combo chip. */
  .blitz-points {
    font-weight: 800;
    font-size: 1.15rem;
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
  }

  .blitz-points small {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--color-muted);
  }

  /* Blitz multiplier badge (this task). It's the run's live-combo centrepiece now the streak pill is
     gone, so it's larger and *escalates*: at x1 a calm outlined "base" pill; from x2 it lights up —
     filled in the tier's heat colour with a growing glow — and pops (a scale overshoot that grows a
     touch per tier) each time the multiplier climbs. The `--combo-*` vars are set inline per tier. */
  .blitz-combo {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
    padding: 0.24rem 0.62rem;
    border-radius: 999px;
    border: 2px solid var(--combo-heat, var(--color-accent));
    background: transparent;
    color: var(--combo-heat, var(--color-accent));
    font-weight: 900;
    font-size: 1.15rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    animation: combo-pop 0.34s cubic-bezier(0.2, 0.9, 0.3, 1);
    transition:
      color 0.2s ease,
      background 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  /* x2+: the combo is "lit" — a filled, glowing pill in the tier's heat colour with white numerals. */
  .blitz-combo.hot {
    color: #fff;
    background: var(--combo-heat);
    border-color: var(--combo-heat);
    box-shadow:
      0 0 var(--combo-glow, 8px) color-mix(in srgb, var(--combo-heat) 60%, transparent),
      0 2px 6px rgb(0 0 0 / 18%);
  }

  .combo-num {
    letter-spacing: -0.01em;
  }

  @keyframes combo-pop {
    0% {
      transform: scale(0.7);
    }
    55% {
      transform: scale(var(--combo-peak, 1.14));
    }
    100% {
      transform: scale(1);
    }
  }

  /* The badge stacks over its reaction meter; `--combo-*` live here so both inherit the tier heat. */
  .combo-wrap {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  /* Reaction meter: a slim reverse-progress bar under the badge that drains over the combo window.
     Always in the layout (so nothing jumps); faded in only while a combo is at stake. */
  .combo-timer {
    width: 100%;
    height: 3px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-muted) 28%, transparent);
    overflow: hidden;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .combo-timer.shown {
    opacity: 1;
  }

  .combo-timer-fill {
    display: block;
    height: 100%;
    width: 100%;
    transform-origin: left center;
    border-radius: 999px;
    background: var(--combo-heat, var(--color-accent));
    /* Eases the ~100 ms clock ticks into a smooth drain; colour eases on tier change. */
    transition:
      transform 0.12s linear,
      background 0.2s ease;
  }

  /* Near-empty: the meter flushes to the "wrong" red — answer now or the combo drops. */
  .combo-timer-fill.urgent {
    background: var(--color-wrong);
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

  .prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 0;
  }

  /* Map modes: the board is the surface, so the prompt is a tight caption above it, not a padded
     block. Collapse its own padding and pull the board up close — reclaiming the over-generous
     space that used to bracket "Which country is highlighted?" / the locate prompt. */
  .prompt.map-prompt {
    gap: 0.15rem;
    padding: 0;
    margin: -0.4rem 0 -0.7rem;
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
    .blitz-combo,
    .dir-tray,
    .launch-veil,
    .launch-badge {
      animation: none;
    }

    .opt,
    .cat-card,
    .region-opt,
    .start,
    .heart {
      transition: none;
    }

    /* Keep the reaction meter draining (it's informational), just without the easing tween. */
    .combo-timer-fill {
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
      /* Two-up on phones so the four format cards stay a compact 2×2, not a long stack. */
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 480px) {
    .cat-grid,
    .dir-row {
      grid-template-columns: 1fr;
    }
  }

  /* The map is the primary surface, but on a phone the content column is narrow (and further
     inset by the content's 1rem side padding), so the map ends up small. Let the board reach
     most of the way out — canceling all but a slim ~0.5rem gutter so it breathes at the screen
     edge — and let the map render taller (see WorldMap `.map`, which gives it a 3/2 frame under
     640px). The projection stays memoized at its fixed 980×500 viewBox. Desktop keeps the
     framed, centred column. */
  @media (max-width: 640px) {
    .board {
      margin-inline: -0.5rem;
    }

    /* Match the taller mobile board while the lazily-imported map chunk loads. */
    .placeholder {
      aspect-ratio: 3 / 2;
    }
  }
</style>
