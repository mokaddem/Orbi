<script lang="ts">
  import { t } from '../../i18n';
  import Icon from './Icon.svelte';

  // Shared map-load error card. Shown by MapBoard (data-load failures) and Play (map-component
  // chunk-load failures). Keeps the map board's footprint (`aspect-ratio`) so the layout doesn't
  // jump when it swaps in. `code` is the short MAP-… debugging handle (see `mapErrorCode`).
  //
  // `onRetry` is optional. Two flavours: an in-place **Retry** (data-load failures — the geometry
  // loader no longer caches a rejected promise, so a re-fetch works), or a **Reload** (`reload`),
  // used for a failed component-chunk import — the browser caches a failed dynamic import, so the
  // only reliable recovery is a full page reload (also the right move for a stale-deploy chunk).
  let {
    code,
    retrying = false,
    reload = false,
    onRetry = null,
  }: {
    code: string;
    retrying?: boolean;
    reload?: boolean;
    onRetry?: (() => void) | null;
  } = $props();
</script>

<div class="map-error" role="alert">
  <span class="map-error-badge" aria-hidden="true"><Icon name="map" size={26} /></span>
  <p class="map-error-title">{$t('play.map.error')}</p>
  <p class="map-error-hint">{$t('play.map.errorHint')}</p>
  {#if onRetry}
    <button type="button" class="map-error-retry" onclick={onRetry} disabled={retrying}>
      <Icon name={reload ? 'reset' : 'repeat'} size={16} />
      <span>
        {#if retrying}
          {$t('play.map.retrying')}
        {:else if reload}
          {$t('play.map.reload')}
        {:else}
          {$t('play.map.retry')}
        {/if}
      </span>
    </button>
  {/if}
  <span class="map-error-code" title={$t('play.map.errorCodeLabel')}>{code}</span>
</div>

<style>
  .map-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    /* Match MapBoard's `.placeholder` so swapping error ↔ loading ↔ map never shifts the layout. */
    aspect-ratio: 980 / 500;
    width: 100%;
    padding: 1.25rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    text-align: center;
    color: var(--color-muted);
  }

  @media (max-width: 640px) {
    .map-error {
      aspect-ratio: 3 / 2;
    }
  }

  .map-error-badge {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--color-accent-weak);
    color: var(--color-accent-strong);
  }

  .map-error-title {
    margin: 0;
    font-weight: 700;
    color: var(--color-text);
  }

  .map-error-hint {
    margin: 0;
    max-width: 28ch;
    font-size: 0.85rem;
    line-height: 1.35;
  }

  .map-error-retry {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    margin-top: 0.15rem;
    padding: 0.5rem 1rem;
    background: var(--color-accent);
    border: 0;
    border-radius: 999px;
    color: #fff;
    font-weight: 600;
    cursor: pointer;
    transition:
      transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1),
      filter 0.12s ease;
  }

  .map-error-retry:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.05);
  }

  .map-error-retry:disabled {
    opacity: 0.6;
    cursor: default;
  }

  /* The debugging handle: quiet, monospace, selectable so a reporting player can copy it. */
  .map-error-code {
    margin-top: 0.1rem;
    padding: 0.1rem 0.5rem;
    border-radius: 6px;
    background: var(--color-border);
    color: var(--color-muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.72rem;
    letter-spacing: 0.03em;
    user-select: all;
  }

  @media (prefers-reduced-motion: reduce) {
    .map-error-retry {
      transition: none;
    }
  }
</style>
