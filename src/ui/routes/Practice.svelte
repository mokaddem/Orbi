<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { t, localizedName, localizedRegion } from '../../i18n';
  import { practiceEligibility, type GameMode, type SessionType } from '../../domain';
  import { getCountries, getRegionTree, type Country, type CustomSet } from '../../data';
  import { pendingConfig, practiceToConfig } from '../stores/game';
  import {
    prefs,
    storageReady,
    persistent,
    loadCustomSets,
    saveCustomSet,
    deleteCustomSet,
  } from '../stores/persistence';
  import { searchCountries } from './atlas-search';
  import Flag from '../components/Flag.svelte';
  import Icon from '../components/Icon.svelte';
  import ModeIcon from '../components/ModeIcon.svelte';
  import RegionIcon from '../components/RegionIcon.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';

  // The selectable modes, in display order (same list the Play setup drives from).
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

  const all = getCountries();
  const byIso = new Map(all.map((c) => [c.iso2, c]));
  const regionTree = getRegionTree();

  // --- Working set + setup selections ---
  let selected = $state<string[]>([]);
  let mode = $state<GameMode>('flag-to-country');
  let type = $state<SessionType>('fixed');
  let query = $state('');
  let expanded = $state<Record<string, boolean>>({});

  const selectedSet = $derived(new Set(selected));
  const nameOf = $derived($localizedName);

  // Region groups with their members sorted by the localized name (re-sorts on locale change).
  const groups = $derived(
    regionTree.map((r) => ({
      region: r.region,
      countries: [...r.countries].sort((a, b) => nameOf(a).localeCompare(nameOf(b))),
    })),
  );

  const hasQuery = $derived(query.trim().length > 0);
  const matchIsos = $derived(new Set(searchCountries(all, query).map((c) => c.iso2)));
  const anyMatch = $derived(!hasQuery || groups.some((g) => visibleIn(g.countries).length > 0));

  /** Members of a group visible under the current search (all of them when no query). */
  function visibleIn(countries: Country[]): Country[] {
    return hasQuery ? countries.filter((c) => matchIsos.has(c.iso2)) : countries;
  }

  /** A group is open when explicitly expanded, or force-open while a search is active. */
  function isOpen(region: string): boolean {
    return hasQuery || !!expanded[region];
  }

  function toggleGroup(region: string): void {
    expanded = { ...expanded, [region]: !expanded[region] };
  }

  // --- Selection edits (pure helpers keep the set math testable; here it's plain arrays) ---
  function toggleCountry(iso2: string): void {
    selected = selected.includes(iso2) ? selected.filter((c) => c !== iso2) : [...selected, iso2];
  }

  function selectAll(countries: Country[]): void {
    const add = countries.map((c) => c.iso2).filter((iso) => !selectedSet.has(iso));
    selected = [...selected, ...add];
  }

  function deselectAll(countries: Country[]): void {
    const drop = new Set(countries.map((c) => c.iso2));
    selected = selected.filter((iso) => !drop.has(iso));
  }

  function clearAll(): void {
    selected = [];
  }

  const chosenCountries = $derived(
    selected.map((iso) => byIso.get(iso)).filter((c): c is Country => !!c),
  );
  const eligibility = $derived(practiceEligibility(mode, chosenCountries));
  const canStart = $derived(eligibility.eligible.length > 0);

  // --- Launch: stage the config and hand off to the Play route (like Retry from Summary) ---
  function launch(isoList: readonly string[]): void {
    const eligible = practiceEligibility(
      mode,
      isoList.map((iso) => byIso.get(iso)).filter((c): c is Country => !!c),
    ).eligible;
    if (eligible.length === 0) return;
    pendingConfig.set(
      practiceToConfig(
        mode,
        type,
        eligible.map((c) => c.iso2),
        $prefs,
      ),
    );
    push('/play');
  }

  function startPractice(): void {
    launch(selected);
  }

  // --- Saved sets ---
  let savedSets = $state<CustomSet[]>([]);
  let editingId = $state<string | null>(null);
  let setName = $state('');
  let savedFlash = $state(false);
  let deleteTarget = $state<CustomSet | null>(null);

  async function refreshSets(): Promise<void> {
    savedSets = await loadCustomSets();
  }

  onMount(() => {
    void refreshSets();
  });

  $effect(() => {
    if ($storageReady) void refreshSets();
  });

  const canSave = $derived(setName.trim().length > 0 && selected.length > 0);

  async function saveSet(): Promise<void> {
    if (!canSave) return;
    const saved = await saveCustomSet({
      id: editingId ?? undefined,
      name: setName.trim(),
      iso2: selected,
    });
    if (saved) {
      editingId = saved.id;
      savedFlash = true;
      setTimeout(() => (savedFlash = false), 1500);
      await refreshSets();
    }
  }

  /** Load a set into the working area for editing (does not start a session). */
  function editSet(set: CustomSet): void {
    selected = [...set.iso2];
    setName = set.name;
    editingId = set.id;
    query = '';
    // Bring the picker back to a known state so the loaded set is visible. The app-shell layout
    // scrolls `#app-scroll` (the content region), not the window.
    document.getElementById('app-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Clear the working area to start a fresh, unnamed set. */
  function newSet(): void {
    selected = [];
    setName = '';
    editingId = null;
    query = '';
  }

  async function confirmDelete(): Promise<void> {
    const target = deleteTarget;
    deleteTarget = null;
    if (!target) return;
    await deleteCustomSet(target.id);
    if (editingId === target.id) newSet();
    await refreshSets();
  }
</script>

<section class="practice">
  <header class="head">
    <h1>{$t('practice.title')}</h1>
    <p class="intro">{$t('practice.intro')}</p>
  </header>

  {#if !$persistent}
    <p class="warn" role="status">{$t('settings.notPersisted')}</p>
  {/if}

  <div class="practice-cols">
    <div class="pane-left">
      <!-- Saved sets -->
      <section class="block saved">
        <h2>{$t('practice.savedSets.title')}</h2>
        {#if savedSets.length === 0}
          <p class="muted">{$t('practice.savedSets.empty')}</p>
        {:else}
          <ul class="set-list">
            {#each savedSets as set (set.id)}
              <li class="set-row" class:editing={editingId === set.id}>
                <div class="set-meta">
                  <span class="set-name">{set.name}</span>
                  <span class="set-count"
                    >{$t('practice.savedSets.count', { count: set.iso2.length })}</span
                  >
                </div>
                <div class="set-actions">
                  <button type="button" class="pill accent" onclick={() => launch(set.iso2)}>
                    <Icon name="play" size={14} />
                    {$t('practice.savedSets.play')}
                  </button>
                  <button type="button" class="pill" onclick={() => editSet(set)}>
                    {$t('practice.savedSets.edit')}
                  </button>
                  <button
                    type="button"
                    class="pill danger"
                    aria-label={$t('practice.savedSets.delete')}
                    onclick={() => (deleteTarget = set)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <!-- Country picker -->
      <section class="block">
        <div class="block-head">
          <h2>{$t('practice.picker.title')}</h2>
          <span class="chosen-count" role="status">
            {$t('practice.picker.chosen', { count: selected.length })}
          </span>
        </div>

        <label class="search">
          <span class="search-ico"><Icon name="search" size={16} /></span>
          <input
            type="search"
            bind:value={query}
            placeholder={$t('practice.picker.searchPlaceholder')}
            aria-label={$t('practice.picker.searchLabel')}
          />
        </label>

        {#if selected.length > 0}
          <div class="chips" aria-label={$t('practice.picker.chosen', { count: selected.length })}>
            {#each chosenCountries as c (c.iso2)}
              <button type="button" class="chip" onclick={() => toggleCountry(c.iso2)}>
                <span class="chip-flag"><Flag country={c} /></span>
                <span class="chip-name">{$localizedName(c)}</span>
                <span class="chip-x" aria-hidden="true">×</span>
              </button>
            {/each}
            <button type="button" class="pill clear" onclick={clearAll}>
              {$t('practice.picker.clearAll')}
            </button>
          </div>
        {/if}

        {#if hasQuery && !anyMatch}
          <p class="muted">{$t('practice.picker.noResults', { query })}</p>
        {/if}

        <div class="region-groups">
          {#each groups as group (group.region)}
            {@const visible = visibleIn(group.countries)}
            {#if !hasQuery || visible.length > 0}
              {@const chosenN = group.countries.filter((c) => selectedSet.has(c.iso2)).length}
              <div class="group" class:open={isOpen(group.region)}>
                <div class="group-head">
                  <button
                    type="button"
                    class="group-toggle"
                    aria-expanded={isOpen(group.region)}
                    onclick={() => toggleGroup(group.region)}
                  >
                    <span class="chev" class:rot={isOpen(group.region)}>
                      <Icon name="chevron-right" size={16} />
                    </span>
                    <span class="group-ico"><RegionIcon region={group.region} /></span>
                    <span class="group-name">{$localizedRegion(group.region)}</span>
                    <span class="group-count">{chosenN}/{group.countries.length}</span>
                  </button>
                  <div class="group-bulk">
                    <button type="button" class="pill" onclick={() => selectAll(visible)}>
                      {$t('practice.picker.all')}
                    </button>
                    <button type="button" class="pill" onclick={() => deselectAll(visible)}>
                      {$t('practice.picker.none')}
                    </button>
                  </div>
                </div>

                {#if isOpen(group.region)}
                  <ul class="country-list">
                    {#each visible as c (c.iso2)}
                      <li>
                        <button
                          type="button"
                          class="country"
                          class:selected={selectedSet.has(c.iso2)}
                          aria-pressed={selectedSet.has(c.iso2)}
                          onclick={() => toggleCountry(c.iso2)}
                        >
                          <span class="check" aria-hidden="true">
                            {#if selectedSet.has(c.iso2)}<Icon name="check" size={14} />{/if}
                          </span>
                          <span class="country-flag"><Flag country={c} /></span>
                          <span class="country-name">{$localizedName(c)}</span>
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      </section>

      <!-- Save this set -->
      <section class="block save">
        <h2>{$t('practice.save.title')}</h2>
        {#if editingId}
          {@const editingSet = savedSets.find((s) => s.id === editingId)}
          {#if editingSet}
            <p class="muted editing-note">{$t('practice.editing', { name: editingSet.name })}</p>
          {/if}
        {/if}
        <div class="save-row">
          <input
            type="text"
            class="name-input"
            bind:value={setName}
            placeholder={$t('practice.save.namePlaceholder')}
            aria-label={$t('practice.save.nameLabel')}
          />
          <button type="button" class="pill accent save-btn" disabled={!canSave} onclick={saveSet}>
            {savedFlash
              ? $t('practice.save.saved')
              : editingId
                ? $t('practice.save.update')
                : $t('practice.save.save')}
          </button>
          {#if editingId}
            <button type="button" class="pill" onclick={newSet}>
              <Icon name="plus" size={14} />
              {$t('practice.newSet')}
            </button>
          {/if}
        </div>
      </section>
    </div>

    <div class="pane-right">
      <!-- Mode -->
      <section class="block">
        <h2>{$t('practice.mode.title')}</h2>
        <div class="mode-grid">
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
        {#if selected.length > 0 && eligibility.skipped.length > 0}
          <p class="coverage" role="status">
            {#if eligibility.eligible.length === 0}
              {$t('practice.mode.coverageNone')}
            {:else}
              {$t('practice.mode.coverage', {
                eligible: eligibility.eligible.length,
                total: chosenCountries.length,
              })}
            {/if}
          </p>
        {/if}
      </section>

      <!-- Format -->
      <section class="block">
        <h2>{$t('practice.type.title')}</h2>
        <div class="type-grid">
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
      </section>

      <div class="start-row">
        <button type="button" class="start" disabled={!canStart} onclick={startPractice}>
          {$t('practice.start')}
        </button>
        {#if !canStart}
          <small class="muted">{$t('practice.startHint')}</small>
        {/if}
      </div>
    </div>
  </div>
</section>

<ConfirmDialog
  open={deleteTarget !== null}
  title={$t('practice.savedSets.deleteTitle')}
  message={$t('practice.savedSets.deleteMessage', { name: deleteTarget?.name ?? '' })}
  confirmLabel={$t('practice.savedSets.delete')}
  onconfirm={confirmDelete}
  oncancel={() => (deleteTarget = null)}
/>

<style>
  .practice {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Desktop (Phase 34): a two-pane builder — the country-picking workflow (saved sets,
     picker, save) on the left, and a persistent "what you'll play" panel (mode, format,
     Start) that sticks in view on the right while the picker scrolls. Mobile stacks them. */
  .practice-cols,
  .pane-left,
  .pane-right {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  @media (min-width: 860px) {
    .practice-cols {
      display: grid;
      grid-template-columns: 1fr minmax(320px, 400px);
      gap: 2rem;
      align-items: start;
    }

    .pane-right {
      position: sticky;
      top: 1.5rem;
    }
  }

  .head h1 {
    margin: 0 0 0.25rem;
  }

  .intro {
    margin: 0;
    color: var(--color-muted);
  }

  .warn {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius);
    background: var(--color-wrong-bg);
    color: var(--color-wrong);
    font-size: 0.9rem;
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .block h2 {
    margin: 0;
    font-size: 1.05rem;
  }

  .block-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  .chosen-count {
    color: var(--color-accent);
    font-weight: 700;
    font-size: 0.9rem;
  }

  .muted {
    margin: 0;
    color: var(--color-muted);
    font-size: 0.9rem;
  }

  /* Saved sets */
  .set-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .set-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.6rem 0.85rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .set-row.editing {
    border-color: var(--color-accent);
    background: var(--color-accent-weak);
  }

  .set-meta {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .set-name {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .set-count {
    font-size: 0.8rem;
    color: var(--color-muted);
  }

  .set-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  /* Search */
  .search {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-ico {
    position: absolute;
    left: 0.7rem;
    color: var(--color-muted);
    display: inline-flex;
  }

  .search input {
    width: 100%;
    padding: 0.6rem 0.75rem 0.6rem 2.2rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    font: inherit;
  }

  .search input:focus-visible {
    outline: none;
    border-color: var(--color-accent);
  }

  /* Chosen chips */
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    max-height: 9rem;
    overflow-y: auto;
    padding: 0.15rem;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.2rem 0.5rem 0.2rem 0.35rem;
    background: var(--color-accent-weak);
    border: 1px solid var(--color-accent);
    border-radius: 999px;
    color: var(--color-accent-strong);
    font-size: 0.82rem;
    font-weight: 600;
  }

  .chip-flag {
    width: 1.3rem;
    display: block;
  }

  .chip-flag :global(.flag) {
    border-radius: 3px;
  }

  .chip-x {
    font-size: 1rem;
    line-height: 1;
    opacity: 0.7;
  }

  .chip:hover .chip-x {
    opacity: 1;
  }

  /* Region groups */
  .region-groups {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .group {
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    overflow: hidden;
  }

  .group.open {
    border-color: var(--color-accent-weak);
  }

  .group-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
  }

  .group-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
    background: none;
    border: none;
    color: var(--color-text);
    font-weight: 700;
    text-align: left;
    padding: 0.25rem;
  }

  .chev {
    display: inline-flex;
    color: var(--color-muted);
    transition: transform 0.15s ease;
  }

  .chev.rot {
    transform: rotate(90deg);
  }

  .group-ico {
    display: inline-flex;
    width: 1.6rem;
    height: 1.6rem;
    color: var(--color-muted);
  }

  .group-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .group-count {
    color: var(--color-muted);
    font-size: 0.82rem;
    font-weight: 600;
  }

  .group-bulk {
    display: flex;
    gap: 0.3rem;
    flex-shrink: 0;
  }

  .country-list {
    list-style: none;
    margin: 0;
    padding: 0.25rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: 0.25rem;
    border-top: 1px solid var(--color-border);
  }

  .country {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.4rem 0.5rem;
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius);
    color: var(--color-text);
    text-align: left;
    font-weight: 500;
  }

  .country:hover {
    background: var(--color-accent-weak);
  }

  .country.selected {
    background: var(--color-accent-weak);
    border-color: var(--color-accent);
    font-weight: 700;
  }

  .check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.1rem;
    height: 1.1rem;
    flex-shrink: 0;
    border: 1.5px solid var(--color-border);
    border-radius: 4px;
    color: var(--color-accent-contrast);
  }

  .country.selected .check {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }

  .country-flag {
    width: 1.6rem;
    flex-shrink: 0;
    display: block;
  }

  .country-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Save row */
  .editing-note {
    color: var(--color-accent-strong);
  }

  .save-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .name-input {
    flex: 1;
    min-width: 12rem;
    padding: 0.55rem 0.75rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    font: inherit;
  }

  .name-input:focus-visible {
    outline: none;
    border-color: var(--color-accent);
  }

  /* Mode + type grids reuse the Play setup card look */
  .mode-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }

  .type-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }

  .opt {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.75rem 0.9rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    font-weight: 600;
    text-align: left;
    box-shadow: var(--shadow-card);
    transition:
      border-color 0.12s ease,
      background 0.12s ease;
  }

  .opt small {
    font-weight: 400;
    color: var(--color-muted);
  }

  .opt-title {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .mode-opt {
    flex-direction: row;
    align-items: center;
    gap: 0.6rem;
  }

  .mode-opt :global(.mode-icon) {
    color: var(--color-muted);
  }

  .mode-opt.selected :global(.mode-icon) {
    color: var(--color-accent);
  }

  .opt:hover {
    border-color: var(--color-accent);
  }

  .opt.selected {
    border-color: var(--color-accent);
    background: var(--color-accent-weak);
    box-shadow: var(--ring-selected);
  }

  .coverage {
    margin: 0;
    color: var(--color-muted);
    font-size: 0.9rem;
  }

  /* Pills + start */
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.7rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    color: var(--color-text);
    font-size: 0.82rem;
    font-weight: 600;
  }

  .pill:hover {
    border-color: var(--color-accent);
  }

  .pill.accent {
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border-color: var(--color-accent);
  }

  .pill.danger:hover {
    border-color: var(--color-wrong);
    color: var(--color-wrong);
  }

  .pill:disabled {
    opacity: 0.5;
  }

  .start-row {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    align-items: flex-start;
  }

  .start {
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

  .start:not(:disabled):hover {
    transform: translateY(-2px);
  }

  .start:not(:disabled):active {
    transform: translateY(2px);
    box-shadow: var(--shadow-chunky-press);
  }

  .start:disabled {
    opacity: 0.5;
  }

  @media (max-width: 480px) {
    .mode-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chev,
    .opt,
    .start {
      transition: none;
    }
    .start:not(:disabled):hover {
      transform: none;
    }
  }
</style>
