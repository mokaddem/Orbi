<script lang="ts">
  import { t } from '../../i18n';

  // Type-ahead picker for a Grandmaster Run's name / capital directions (Phase 44). The whole
  // continent is the option pool (no 4-choice crutch, and it never shrinks) — far too many for a
  // button grid — so the player recalls the answer and types to filter to it. Purely presentational:
  // the caller pre-localizes the labels and owns grading. Once `answered`, the input locks and the
  // list collapses to a compact reveal (the correct option, plus the player's pick if it was wrong).

  interface Option {
    id: string;
    label: string;
  }

  let {
    options,
    placeholder,
    answered = false,
    correctId = null,
    pickedId = null,
    onpick,
  }: {
    options: Option[];
    placeholder: string;
    answered?: boolean;
    /** Id of the correct option — highlighted green once `answered`. */
    correctId?: string | null;
    /** Id the player chose — marked red once `answered` (a wrong pick ends the one-life run). */
    pickedId?: string | null;
    onpick: (id: string) => void;
  } = $props();

  let query = $state('');

  // Clear the query whenever the option set changes (a fresh question), keyed by a cheap signature.
  let sig: string | null = null;
  $effect(() => {
    const next = options.map((o) => o.id).join(',');
    if (next !== sig) {
      sig = next;
      query = '';
    }
  });

  // Accent-insensitive contains match, so "sao tome" finds "São Tomé and Príncipe".
  const norm = (s: string): string =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  const q = $derived(norm(query.trim()));
  const filtered = $derived(q === '' ? options : options.filter((o) => norm(o.label).includes(q)));

  // Once answered the list collapses to the reveal: the correct option (green), then the player's
  // pick (red) if they missed. Keeps a long continent list from scrolling past the verdict.
  const revealRows = $derived.by<Option[]>(() => {
    if (!answered) return filtered;
    const rows: Option[] = [];
    const correct = options.find((o) => o.id === correctId);
    if (correct) rows.push(correct);
    if (pickedId && pickedId !== correctId) {
      const picked = options.find((o) => o.id === pickedId);
      if (picked) rows.push(picked);
    }
    return rows;
  });

  function stateFor(id: string): '' | 'correct' | 'wrong' {
    if (!answered) return '';
    if (id === correctId) return 'correct';
    if (id === pickedId) return 'wrong';
    return '';
  }

  // Commit a pick and reset the query. In a Grandmaster run the option pool is the *whole continent,
  // fixed for every question*, so the "options changed → clear" guard above never fires between
  // questions — without clearing here, the text typed for one country would linger into the next.
  function pick(id: string): void {
    query = '';
    onpick(id);
  }

  // Enter commits the top match — quick type-ahead selection without reaching for the mouse.
  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !answered && filtered.length > 0) {
      e.preventDefault();
      pick(filtered[0].id);
    }
  }
</script>

<div class="search" class:answered>
  {#if !answered}
    <input
      type="text"
      class="search-input"
      {placeholder}
      bind:value={query}
      onkeydown={onKeydown}
      aria-label={placeholder}
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
    />
  {/if}
  <ul
    class="results"
    role="listbox"
    aria-label={$t('challenge.search.resultsAria', { count: filtered.length })}
  >
    {#each revealRows as o (o.id)}
      <li>
        <button
          type="button"
          class="result {stateFor(o.id)}"
          class:answered
          data-id={o.id}
          disabled={answered}
          onclick={() => pick(o.id)}
        >
          {o.label}
        </button>
      </li>
    {/each}
    {#if !answered && filtered.length === 0}
      <li class="no-match">{$t('challenge.search.noMatch')}</li>
    {/if}
  </ul>
</div>

<style>
  .search {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    /* Fill the arena column so the results fill the whole screen below the fixed search input (the
       same reclaim as the country-to-flag grid), instead of the input floating over a mostly empty
       page on mobile. min-height:0 lets the inner list scroll rather than the outer column. */
    flex: 1 1 auto;
    min-height: 0;
  }

  /* On the answered reveal the list is only 1–2 rows — stop growing so the verdict card sits right
     beneath them instead of after a tall empty gap. */
  .search.answered {
    flex: 0 0 auto;
  }

  .search-input {
    width: 100%;
    padding: 0.7rem 1rem;
    font: inherit;
    font-size: 1.05rem;
    color: var(--color-text);
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: var(--ring-selected);
  }

  .results {
    list-style: none;
    margin: 0;
    /* Scrolls within its own box so a 54-country list never runs the whole page long. The bottom
       padding lets the last row scroll fully clear of the fade mask, which dissolves any overflow
       into the ground (a soft "more below" hint) instead of a hard clip through a row. */
    padding: 0 0 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 1.75rem), transparent);
    mask-image: linear-gradient(to bottom, #000 calc(100% - 1.75rem), transparent);
  }

  /* On the answered reveal there are only 1–2 rows — let them size naturally, no scrollbox / fade. */
  .search.answered .results {
    flex: 0 0 auto;
    padding: 0;
    overflow: visible;
    -webkit-mask-image: none;
    mask-image: none;
  }

  .result {
    width: 100%;
    text-align: left;
    padding: 0.6rem 0.9rem;
    font-weight: 600;
    color: var(--color-text);
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: 14px;
    box-shadow: var(--shadow-card);
    transition:
      transform 0.1s ease,
      border-color 0.1s ease,
      background 0.1s ease;
  }

  .result:hover:not(:disabled) {
    border-color: var(--color-accent);
    transform: translateY(-1px);
  }

  .result:disabled {
    cursor: default;
  }

  .result.correct {
    border-color: var(--color-correct);
    background: var(--color-correct-bg);
    color: var(--color-correct);
  }

  .result.wrong {
    border-color: var(--color-wrong);
    background: var(--color-wrong-bg);
    color: var(--color-wrong);
  }

  .no-match {
    padding: 0.6rem 0.9rem;
    color: var(--color-muted);
    font-style: italic;
  }

  @media (prefers-reduced-motion: reduce) {
    .result {
      transition: none;
    }
    .result:hover:not(:disabled) {
      transform: none;
    }
  }
</style>
