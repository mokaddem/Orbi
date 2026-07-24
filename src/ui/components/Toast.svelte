<script lang="ts">
  // Small transient toast (proposed in the duel "send a challenge" redesign) — a presentational,
  // fixed-position status pill that floats above the bottom nav. The caller owns the message + when it
  // clears (it already has the timers today); this just renders it when non-empty and animates in.
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  let {
    message = '',
    icon = 'check',
  }: {
    /** The already-localised line to show; empty = hidden. */
    message?: string;
    /** Leading icon (defaults to a success check). */
    icon?: IconName;
  } = $props();
</script>

{#if message}
  <div class="toast-wrap" role="status" aria-live="polite">
    <div class="toast">
      <span class="toast-ico" aria-hidden="true"><Icon name={icon} size="1em" /></span>
      <span class="toast-msg">{message}</span>
    </div>
  </div>
{/if}

<style>
  .toast-wrap {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
    z-index: 200;
    display: flex;
    justify-content: center;
    padding-inline: 1rem;
    pointer-events: none;
  }

  .toast {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    max-width: min(92vw, 26rem);
    padding: 0.7rem 1.1rem;
    border-radius: 999px;
    background: var(--color-text);
    color: var(--color-surface);
    font-weight: 700;
    font-size: 0.92rem;
    box-shadow: 0 10px 30px rgb(26 36 51 / 30%);
    animation: toast-in 0.22s ease;
  }

  .toast-ico {
    display: inline-flex;
    color: var(--color-correct);
  }

  .toast-msg {
    min-width: 0;
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
  }
</style>
