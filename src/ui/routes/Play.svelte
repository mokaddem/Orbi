<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { push } from 'svelte-spa-router';
  import { t, localizedName, localizedText, localizedRegion } from '../../i18n';
  import {
    filterCountries,
    hasOptions,
    isMapMode,
    isMultiSelectMode,
    type GameMode,
    type RegionFilter,
    type SessionType,
  } from '../../domain';
  import { countryCount, getCountries, getRegionTree, type RegionNode } from '../../data';
  import { play, lastSummary, pendingConfig, type RunConfig } from '../stores/game';
  import { prefs, saveSession, saveDailyResult, recordAnswer } from '../stores/persistence';
  import Flag from '../components/Flag.svelte';
  import ChoiceGrid from '../components/ChoiceGrid.svelte';
  import SegmentedControl from '../components/SegmentedControl.svelte';
  import ModeIcon from '../components/ModeIcon.svelte';
  import RegionIcon from '../components/RegionIcon.svelte';
  import Icon from '../components/Icon.svelte';

  // Auto-advance timings (ms): a brief dwell on a correct answer, a longer one on a
  // wrong answer so the revealed country can be read. Fixed by design (not a setting).
  const CORRECT_MS = 1500;
  const WRONG_MS = 3000;

  // Setup selections.
  let mode = $state<GameMode>('flag-to-country');
  let type = $state<SessionType>('fixed');

  /** The selectable modes, in display order, with their label keys. */
  const MODE_OPTIONS: { mode: GameMode; labelKey: string }[] = [
    { mode: 'flag-to-country', labelKey: 'modes.flagToCountry' },
    { mode: 'country-to-flag', labelKey: 'modes.countryToFlag' },
    { mode: 'map-highlight', labelKey: 'modes.mapHighlight' },
    { mode: 'map-locate', labelKey: 'modes.mapLocate' },
    { mode: 'capital-to-country', labelKey: 'modes.capitalToCountry' },
    { mode: 'country-to-capital', labelKey: 'modes.countryToCapital' },
    { mode: 'country-to-languages', labelKey: 'modes.countryToLanguages' },
    { mode: 'country-to-industry', labelKey: 'modes.mainIndustries' },
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
    const delay = $play.feedback?.correct ? CORRECT_MS : WRONG_MS;
    const id = setTimeout(onContinue, delay);
    return () => clearTimeout(id);
  });

  // ISO codes to frame the map on, for a filtered map session. Memoized by config
  // identity so it returns a *stable* array within a session — the config object is
  // set once per session, so the map's projection is computed once, not per question.
  let focusCfg: RunConfig | null = null;
  let focusIsos: string[] | null = null;
  function mapFocusIsos(cfg: RunConfig | null): string[] | null {
    if (cfg === focusCfg) return focusIsos;
    focusCfg = cfg;
    focusIsos =
      cfg && cfg.filter && (cfg.filter.region || cfg.filter.subregion)
        ? filterCountries(getCountries(), cfg.filter).map((c) => c.iso2)
        : null;
    return focusIsos;
  }
</script>

{#if $play.status === 'idle'}
  <section class="setup">
    <h1>{$t('play.title')}</h1>

    <div class="field">
      <span class="legend">{$t('play.setup.chooseMode')}</span>
      <div class="options">
        {#each MODE_OPTIONS as opt (opt.mode)}
          <button
            type="button"
            class="opt mode-opt"
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

    <div class="field">
      <span class="legend">{$t('play.setup.chooseType')}</span>
      <div class="options">
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
          <div class="lives" aria-label={$t('play.progress.lives')}>
            {#each Array.from({ length: lives }, (_, i) => i) as i (i)}
              <span class="heart" class:lost={i >= s.livesRemaining}
                >{i < s.livesRemaining ? '♥' : '♡'}</span
              >
            {/each}
            <span class="answered">{$t('play.progress.answered', { count: s.results.length })}</span
            >
          </div>
        {/if}

        <div class="score">
          <span>{$t('play.progress.score', { correct: s.correct, total: s.results.length })}</span>
          {#if s.streak > 1}
            <span class="streak"
              ><Icon name="flame" size="0.95em" />
              {$t('play.progress.streak', { streak: s.streak })}</span
            >
          {/if}
          <button type="button" class="quit" onclick={quit}>{$t('play.quit')}</button>
        </div>
      </header>

      <div class="prompt">
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
        {#if MapBoard}
          <MapBoard
            highlightIso={cfg.mode === 'map-highlight' ? question.answer.iso2 : null}
            interactive={cfg.mode === 'map-locate'}
            disabled={answered}
            pickedIso={cfg.mode === 'map-locate' ? (view.feedback?.pickedIso ?? null) : null}
            revealIso={cfg.mode === 'map-locate' && answered ? question.answer.iso2 : null}
            revealLabel={cfg.mode === 'map-locate' && answered
              ? $localizedName(question.answer)
              : null}
            focusIsos={mapFocusIsos(cfg)}
            onpick={onMapPick}
          />
        {:else}
          <div class="placeholder" role="status">
            {mapFailed ? $t('play.map.error') : $t('play.map.loading')}
          </div>
        {/if}
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
          {#if !fb.correct}
            {#if fb.question.mode === 'country-to-languages'}
              <p class="reveal">
                {$t('play.feedback.revealLanguages', {
                  country: $localizedName(fb.question.answer),
                  languages: fb.question.answer.languages
                    .map((l) => $localizedText(l.name))
                    .join(', '),
                })}
              </p>
            {:else if fb.question.mode === 'country-to-industry'}
              <p class="reveal">
                {$t('play.feedback.revealIndustries', {
                  country: $localizedName(fb.question.answer),
                  industries: fb.question.answer.industries
                    .map((i) => $localizedText(i.name))
                    .join(', '),
                })}
              </p>
            {:else}
              <p class="reveal">
                {$t('play.feedback.reveal', {
                  country:
                    fb.question.mode === 'country-to-capital'
                      ? $localizedText(fb.question.answer.capital)
                      : $localizedName(fb.question.answer),
                })}
              </p>
            {/if}
          {/if}
          <div
            class="countdown"
            style="--countdown-ms: {fb.correct ? CORRECT_MS : WRONG_MS}ms"
            aria-hidden="true"
          >
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

  .options {
    display: grid;
    grid-template-columns: 1fr 1fr;
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
    padding: 0.65rem 1.6rem;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border: 0;
    border-radius: var(--radius);
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

  /* Multi-select submit (country-to-languages) */
  .submit-multi {
    align-self: center;
    margin-top: 0.25rem;
    padding: 0.6rem 1.8rem;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border: 0;
    border-radius: var(--radius);
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
    gap: 0.3rem;
    font-size: 1.3rem;
    color: var(--color-wrong);
  }

  .heart.lost {
    color: var(--color-border);
  }

  .lives .answered {
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

  .reveal {
    margin: 0;
    color: var(--color-text);
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
    .streak {
      animation: none;
    }

    .opt,
    .region-opt,
    .start {
      transition: none;
    }

    .opt:hover,
    .region-opt:hover,
    .start:hover {
      transform: none;
    }
  }

  @media (max-width: 480px) {
    .options {
      grid-template-columns: 1fr;
    }
  }
</style>
