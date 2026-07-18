<script lang="ts">
  // One-time "what should we call you?" prompt for duels (Phase 46). Purely presentational: the
  // caller owns `open` and reacts to `onsave` (with the entered name) / `oncancel`. Modeled on
  // ConfirmDialog's modal idiom (Escape / backdrop / Cancel all dismiss; only Save commits). The
  // captured name is persisted by the caller into prefs and embedded in the challenge.
  import { t } from '../../i18n';
  import { PLAYER_NAME_MAX_LENGTH } from '../../data';

  let {
    open,
    initial = '',
    onsave,
    oncancel,
  }: {
    open: boolean;
    /** Pre-fill with the current name when editing rather than first-capturing. */
    initial?: string;
    onsave: (name: string) => void;
    oncancel: () => void;
  } = $props();

  let name = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  // Seed the field from `initial` and land focus each time the prompt opens.
  $effect(() => {
    if (open) {
      name = initial;
      queueMicrotask(() => inputEl?.focus());
    }
  });

  const trimmed = $derived(name.trim());

  function save(): void {
    if (trimmed) onsave(trimmed);
  }

  function onKeydown(e: KeyboardEvent): void {
    if (open && e.key === 'Escape') oncancel();
  }

  function onFormSubmit(e: SubmitEvent): void {
    e.preventDefault();
    save();
  }

  function onBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) oncancel();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <div class="backdrop" role="presentation" onclick={onBackdropClick}>
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duel-name-title"
      aria-describedby="duel-name-body"
    >
      <h2 id="duel-name-title">{$t('duel.namePromptTitle')}</h2>
      <p id="duel-name-body">{$t('duel.namePromptBody')}</p>
      <form class="form" onsubmit={onFormSubmit}>
        <input
          bind:this={inputEl}
          bind:value={name}
          type="text"
          autocomplete="nickname"
          maxlength={PLAYER_NAME_MAX_LENGTH}
          placeholder={$t('duel.namePlaceholder')}
        />
        <div class="actions">
          <button type="button" class="btn cancel" onclick={oncancel}>
            {$t('duel.cancel')}
          </button>
          <button type="submit" class="btn confirm" disabled={!trimmed}>
            {$t('duel.save')}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgb(26 36 51 / 45%);
    animation: fade 0.12s ease;
  }

  .dialog {
    width: 100%;
    max-width: 26rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.25rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: 0 10px 30px rgb(26 36 51 / 25%);
    animation: pop 0.12s ease;
  }

  .dialog h2 {
    margin: 0;
    font-size: 1.15rem;
  }

  .dialog p {
    margin: 0;
    color: var(--color-muted);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .dialog input {
    padding: 0.6rem 0.75rem;
    border-radius: var(--radius);
    border: 2px solid var(--color-border);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 1rem;
  }

  .dialog input:focus-visible {
    outline: none;
    border-color: var(--color-accent);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    margin-top: 0.25rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: var(--radius);
    border: 1px solid var(--color-border);
    font-weight: 600;
  }

  .cancel {
    background: var(--color-surface);
    color: var(--color-text);
  }

  .cancel:hover {
    border-color: var(--color-accent);
  }

  .confirm {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-accent-contrast);
  }

  .confirm:hover:not(:disabled) {
    filter: brightness(1.05);
  }

  .confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .backdrop,
    .dialog {
      animation: none;
    }
  }
</style>
