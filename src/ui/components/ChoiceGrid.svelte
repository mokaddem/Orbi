<script lang="ts">
  import Flag from './Flag.svelte';
  import type { ChoiceOption } from './choice-grid';

  // Multiple-choice answer surface, shared by every option-based mode: country modes
  // (names / flags) and attribute modes (e.g. capital strings). Options are normalized
  // to {@link ChoiceOption} by the caller, which also localizes the labels. Once
  // `answered` is set the grid locks and reveals: the correct option is highlighted,
  // and the picked-but-wrong option is marked. Purely presentational — grading and
  // state live in the caller (the Play shell / play store).
  let {
    options,
    variant,
    answered = false,
    correctId = null,
    pickedId = null,
    onpick,
  }: {
    options: ChoiceOption[];
    /**
     * How each option renders:
     *  - 'name'      → text-only buttons (`flag-to-country`, `capital-to-country`, and
     *                  attribute modes like `country-to-capital`).
     *  - 'name-flag' → a small flag thumbnail beside the name (`map-highlight`: the
     *                  prompt is the map, so the flag is a helpful extra cue).
     *  - 'flag'      → flag buttons, names revealed once answered (`country-to-flag`).
     */
    variant: 'name' | 'name-flag' | 'flag';
    answered?: boolean;
    /** id of the correct option; highlighted green once `answered`. */
    correctId?: string | null;
    /** id of the option the player chose; marked red if wrong. */
    pickedId?: string | null;
    onpick: (id: string) => void;
  } = $props();

  type OptionState = '' | 'correct' | 'wrong' | 'muted';

  function stateFor(o: ChoiceOption): OptionState {
    if (!answered) return '';
    if (o.id === correctId) return 'correct';
    if (o.id === pickedId) return 'wrong';
    return 'muted';
  }
</script>

<div
  class="grid"
  class:flags={variant === 'flag'}
  class:name-flag={variant === 'name-flag'}
  role="group"
>
  {#each options as option (option.id)}
    {@const st = stateFor(option)}
    <button
      type="button"
      class="choice {st}"
      class:answered
      data-id={option.id}
      data-state={st}
      disabled={answered}
      aria-pressed={option.id === pickedId}
      onclick={() => !answered && onpick(option.id)}
    >
      {#if variant === 'flag' && option.country}
        <span class="opt-flag"><Flag country={option.country} /></span>
        {#if answered}<span class="opt-name">{option.label}</span>{/if}
      {:else if variant === 'name-flag' && option.country}
        <span class="opt-thumb"><Flag country={option.country} /></span>
        <span class="opt-name">{option.label}</span>
      {:else}
        <span class="opt-name">{option.label}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .choice {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 3.25rem;
    padding: 0.75rem 1rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    font-weight: 600;
    text-align: center;
    box-shadow: var(--shadow-card);
    transition:
      transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1),
      background 0.12s ease,
      border-color 0.12s ease,
      box-shadow 0.12s ease;
  }

  .choice:not(.answered):hover {
    border-color: var(--color-accent);
    background: var(--color-bg);
    transform: translateY(-2px);
  }

  .choice:not(.answered):active {
    transform: translateY(0) scale(0.985);
  }

  .choice.answered {
    cursor: default;
  }

  .choice.correct {
    border-color: var(--color-correct);
    background: var(--color-correct-bg);
    color: var(--color-correct);
    animation: choice-pop 0.32s ease;
  }

  @keyframes choice-pop {
    0% {
      transform: scale(1);
    }
    40% {
      transform: scale(1.04);
    }
    100% {
      transform: scale(1);
    }
  }

  .choice.wrong {
    border-color: var(--color-wrong);
    background: var(--color-wrong-bg);
    color: var(--color-wrong);
  }

  .choice.muted {
    opacity: 0.55;
  }

  .opt-flag {
    display: block;
    width: 100%;
    max-width: 140px;
  }

  /* name-flag: lay the flag and name out in a row rather than stacked. */
  .grid.name-flag .choice {
    flex-direction: row;
    gap: 0.6rem;
    justify-content: flex-start;
    text-align: left;
  }

  .opt-thumb {
    flex: 0 0 auto;
    width: 34px;
  }

  .opt-name {
    font-size: 0.95rem;
  }

  @media (max-width: 480px) {
    .grid.flags {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .choice.correct {
      animation: none;
    }

    .choice {
      transition: none;
    }

    .choice:not(.answered):hover,
    .choice:not(.answered):active {
      transform: none;
    }
  }
</style>
