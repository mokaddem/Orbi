<script lang="ts">
  // Compact single-select control: renders a tactile button group when the option list
  // is short, and falls back to a native <select> when it's long. Shared by the Play
  // setup's region / sub-region pickers. Purely presentational — the caller owns the
  // selected value and handles changes via `onchange`.
  let {
    options,
    value,
    onchange,
    threshold = 8,
    ariaLabel,
  }: {
    options: { value: string; label: string }[];
    value: string;
    onchange: (value: string) => void;
    /** Max option count still shown as buttons; above this, a dropdown is used. */
    threshold?: number;
    ariaLabel?: string;
  } = $props();

  const asButtons = $derived(options.length <= threshold);
</script>

{#if asButtons}
  <div class="segmented" role="group" aria-label={ariaLabel}>
    {#each options as opt (opt.value)}
      <button
        type="button"
        class="seg"
        class:selected={opt.value === value}
        aria-pressed={opt.value === value}
        onclick={() => onchange(opt.value)}
      >
        {opt.label}
      </button>
    {/each}
  </div>
{:else}
  <select
    class="seg-select"
    aria-label={ariaLabel}
    {value}
    onchange={(e) => onchange(e.currentTarget.value)}
  >
    {#each options as opt (opt.value)}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
{/if}

<style>
  .segmented {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .seg {
    padding: 0.5rem 0.9rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    color: var(--color-text);
    font-weight: 600;
    transition:
      background 0.12s ease,
      border-color 0.12s ease,
      color 0.12s ease;
  }

  .seg:hover {
    border-color: var(--color-accent);
  }

  .seg.selected {
    border-color: var(--color-accent);
    background: var(--color-bg);
    box-shadow: inset 0 0 0 1px var(--color-accent);
    color: var(--color-accent);
  }

  .seg-select {
    width: 100%;
    max-width: 20rem;
    padding: 0.7rem 0.9rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .seg-select:hover {
    border-color: var(--color-accent);
  }
</style>
