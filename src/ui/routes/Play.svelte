<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { push } from 'svelte-spa-router';
  import { t, localizedName, localizedRegion } from '../../i18n';
  import {
    filterCountries,
    hasOptions,
    isMapMode,
    type GameMode,
    type RegionFilter,
    type SessionType,
  } from '../../domain';
  import {
    countryCount,
    getCountries,
    getRegionTree,
    type Country,
    type RegionNode,
  } from '../../data';
  import { play, lastSummary, pendingConfig, type RunConfig } from '../stores/game';
  import { prefs, saveSession, recordAnswer } from '../stores/persistence';
  import Flag from '../components/Flag.svelte';
  import ChoiceGrid from '../components/ChoiceGrid.svelte';

  // Setup selections.
  let mode = $state<GameMode>('flag-to-country');
  let type = $state<SessionType>('fixed');

  // Region filter selections. Empty string means "no narrowing": no region → World
  // (all countries); no sub-region → the whole selected region.
  const regionTree = getRegionTree();
  let selectedRegion = $state<string>('');
  let selectedSubregion = $state<string>('');

  const regionNode = $derived<RegionNode | null>(
    selectedRegion ? (regionTree.find((r) => r.region === selectedRegion) ?? null) : null,
  );
  const subregions = $derived(regionNode?.subregions ?? []);

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

  function onPick(country: Country): void {
    const result = play.answer(country.iso2);
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
      if (summary) void saveSession(summary);
      push('/summary');
    }
  }

  function quit(): void {
    play.reset();
  }

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
        <button
          type="button"
          class="opt"
          class:selected={mode === 'flag-to-country'}
          aria-pressed={mode === 'flag-to-country'}
          onclick={() => (mode = 'flag-to-country')}
        >
          {$t('modes.flagToCountry')}
        </button>
        <button
          type="button"
          class="opt"
          class:selected={mode === 'country-to-flag'}
          aria-pressed={mode === 'country-to-flag'}
          onclick={() => (mode = 'country-to-flag')}
        >
          {$t('modes.countryToFlag')}
        </button>
        <button
          type="button"
          class="opt"
          class:selected={mode === 'map-highlight'}
          aria-pressed={mode === 'map-highlight'}
          onclick={() => (mode = 'map-highlight')}
        >
          {$t('modes.mapHighlight')}
        </button>
        <button
          type="button"
          class="opt"
          class:selected={mode === 'map-locate'}
          aria-pressed={mode === 'map-locate'}
          onclick={() => (mode = 'map-locate')}
        >
          {$t('modes.mapLocate')}
        </button>
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
          {$t('sessionType.fixed')}
          <small>{$t('play.setup.fixedHint', { count: $prefs.fixedLength })}</small>
        </button>
        <button
          type="button"
          class="opt"
          class:selected={type === 'survival'}
          aria-pressed={type === 'survival'}
          onclick={() => (type = 'survival')}
        >
          {$t('sessionType.survival')}
          <small>{$t('play.setup.survivalHint', { lives: $prefs.survivalLives })}</small>
        </button>
      </div>
    </div>

    <div class="field">
      <span class="legend" id="region-legend">{$t('play.setup.chooseRegion')}</span>
      <div class="region-selects">
        <select
          class="region-select"
          aria-labelledby="region-legend"
          value={selectedRegion}
          onchange={(e) => selectRegion(e.currentTarget.value)}
        >
          <option value="">{$t('play.setup.regionWorld')}</option>
          {#each regionTree as r (r.region)}
            <option value={r.region}>{$localizedRegion(r.region)}</option>
          {/each}
        </select>

        {#if subregions.length}
          <select
            class="region-select"
            aria-label={$localizedRegion(selectedRegion)}
            value={selectedSubregion}
            onchange={(e) => (selectedSubregion = e.currentTarget.value)}
          >
            <option value="">
              {$t('play.setup.subregionAll', { region: $localizedRegion(selectedRegion) })}
            </option>
            {#each subregions as s (s.subregion)}
              <option value={s.subregion}>{$localizedRegion(s.subregion)}</option>
            {/each}
          </select>
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
    {@const willFinish =
      cfg.type === 'survival' ? s.livesRemaining <= 0 : s.results.length >= total}

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
            <span class="streak">🔥 {$t('play.progress.streak', { streak: s.streak })}</span>
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
        <ChoiceGrid
          options={question.options}
          variant={cfg.mode === 'country-to-flag' ? 'flag' : 'name'}
          {answered}
          correctIso={question.answer.iso2}
          pickedIso={view.feedback?.pickedIso ?? null}
          onpick={onPick}
        />
      {/if}

      {#if answered && view.feedback}
        {@const fb = view.feedback}
        <div class="feedback" class:correct={fb.correct} class:wrong={!fb.correct} role="status">
          <p class="verdict">
            {fb.correct ? $t('play.feedback.correct') : $t('play.feedback.wrong')}
          </p>
          {#if !fb.correct}
            <p class="reveal">
              {$t('play.feedback.reveal', { country: $localizedName(fb.question.answer) })}
            </p>
          {/if}
          <button type="button" class="continue" onclick={onContinue}>
            {willFinish ? $t('play.feedback.seeResults') : $t('play.feedback.continue')}
          </button>
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
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    font-weight: 600;
    text-align: left;
  }

  .opt small {
    font-weight: 400;
    color: var(--color-muted);
  }

  .region-selects {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .region-select {
    flex: 1 1 12rem;
    min-width: 0;
    padding: 0.7rem 0.9rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .region-select:hover {
    border-color: var(--color-accent);
  }

  .pool-hint {
    color: var(--color-muted);
  }

  .opt:hover {
    border-color: var(--color-accent);
  }

  .opt.selected {
    border-color: var(--color-accent);
    background: var(--color-bg);
    box-shadow: inset 0 0 0 1px var(--color-accent);
  }

  .start {
    align-self: flex-start;
    padding: 0.6rem 1.5rem;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border: 0;
    border-radius: var(--radius);
    font-weight: 700;
  }

  .start:hover {
    filter: brightness(1.05);
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
    background: var(--color-accent);
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
    color: var(--color-text);
    font-weight: 600;
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

  .continue {
    padding: 0.55rem 1.4rem;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border: 0;
    border-radius: var(--radius);
    font-weight: 700;
  }

  .continue:hover {
    filter: brightness(1.05);
  }

  @media (max-width: 480px) {
    .options {
      grid-template-columns: 1fr;
    }
  }
</style>
