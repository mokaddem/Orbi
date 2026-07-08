<script lang="ts">
  // Reusable confirmation modal for destructive actions (Phase 13). Purely
  // presentational: the caller owns the `open` flag and reacts to `onconfirm` /
  // `oncancel`. Rendered only while open, so two instances can share a page without
  // clashing ids. Dismissal is always non-destructive — Escape, a backdrop click, and
  // Cancel all fire `oncancel`; only the confirm button fires `onconfirm`.
  import { t } from '../../i18n';

  let {
    open,
    title,
    message,
    confirmLabel,
    cancelLabel,
    onconfirm,
    oncancel,
  }: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    /** Defaults to the shared "Cancel" string when omitted. */
    cancelLabel?: string;
    onconfirm: () => void;
    oncancel: () => void;
  } = $props();

  let cancelBtn = $state<HTMLButtonElement | null>(null);

  // Land focus on Cancel when the dialog opens — the safe default for a destructive
  // action (an accidental Enter cancels rather than confirms).
  $effect(() => {
    if (open) cancelBtn?.focus();
  });

  function onKeydown(e: KeyboardEvent): void {
    if (open && e.key === 'Escape') oncancel();
  }

  /** Dismiss (cancel) only when the click is on the backdrop itself, not the dialog. */
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
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
    >
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-message">{message}</p>
      <div class="actions">
        <button type="button" class="btn cancel" bind:this={cancelBtn} onclick={oncancel}>
          {cancelLabel ?? $t('common.cancel')}
        </button>
        <button type="button" class="btn confirm" onclick={onconfirm}>
          {confirmLabel}
        </button>
      </div>
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
    background: var(--color-wrong);
    border-color: var(--color-wrong);
    color: var(--color-accent-contrast);
  }

  .confirm:hover {
    filter: brightness(1.05);
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
