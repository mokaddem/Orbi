<script lang="ts">
  import { localizedName } from '../../i18n';
  import Flag from './Flag.svelte';
  import type { Country } from '../../data';

  // Multiple-choice answer surface, shared by both flag modes (and reusable by any
  // option-based mode). Options render either as country names or as flags. Once
  // `answered` is set the grid locks and reveals: the correct option is highlighted,
  // and the picked-but-wrong option is marked. Purely presentational — grading and
  // state live in the caller (the Play shell / play store).
  let {
    options,
    variant,
    answered = false,
    correctIso = null,
    pickedIso = null,
    onpick,
  }: {
    options: Country[];
    /**
     * How each option renders:
     *  - 'name'      → text-only buttons (`flag-to-country`: the prompt is a flag, so
     *                  flags here would trivialise it to picture-matching).
     *  - 'name-flag' → a small flag thumbnail beside the name (`map-highlight`: the
     *                  prompt is the map, so the flag is a helpful extra cue).
     *  - 'flag'      → flag buttons, names revealed once answered (`country-to-flag`).
     */
    variant: 'name' | 'name-flag' | 'flag';
    answered?: boolean;
    /** ISO2 of the correct option; highlighted green once `answered`. */
    correctIso?: string | null;
    /** ISO2 of the option the player chose; marked red if wrong. */
    pickedIso?: string | null;
    onpick: (country: Country) => void;
  } = $props();

  type OptionState = '' | 'correct' | 'wrong' | 'muted';

  function stateFor(c: Country): OptionState {
    if (!answered) return '';
    if (c.iso2 === correctIso) return 'correct';
    if (c.iso2 === pickedIso) return 'wrong';
    return 'muted';
  }
</script>

<div
  class="grid"
  class:flags={variant === 'flag'}
  class:name-flag={variant === 'name-flag'}
  role="group"
>
  {#each options as option (option.iso2)}
    {@const st = stateFor(option)}
    <button
      type="button"
      class="choice {st}"
      class:answered
      data-iso={option.iso2}
      data-state={st}
      disabled={answered}
      aria-pressed={option.iso2 === pickedIso}
      onclick={() => !answered && onpick(option)}
    >
      {#if variant === 'flag'}
        <span class="opt-flag"><Flag country={option} /></span>
        {#if answered}<span class="opt-name">{$localizedName(option)}</span>{/if}
      {:else if variant === 'name-flag'}
        <span class="opt-thumb"><Flag country={option} /></span>
        <span class="opt-name">{$localizedName(option)}</span>
      {:else}
        <span class="opt-name">{$localizedName(option)}</span>
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
