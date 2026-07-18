<script lang="ts">
  // Received-duel screen (Phase 46) — the deep-link target for `#/duel?c=…` (an incoming challenge)
  // and `#/duel?r=…` (a returned result the original challenger opens). Everything rides in the code,
  // so this works on a cold PWA start with no prior state; a missing / corrupt code shows a friendly
  // "broken link" state. Accepting a challenge stashes it in `pendingDuel` and launches the identical
  // seeded round via `pendingConfig` → the Play route; the run finishes to the Summary, which shows
  // the head-to-head verdict (matched by seed). A return code renders the verdict here directly.
  import { push, router } from 'svelte-spa-router';
  import { t, localizedRegion } from '../../i18n';
  import { decodeDuel, duelVerdict, type DuelPayload } from '../../domain';
  import { duelToRunConfig, duelDataVersion, readDuelQuery } from '../duel';
  import { pendingConfig, pendingDuel } from '../stores/game';
  import Icon from '../components/Icon.svelte';
  import Mascot from '../components/Mascot.svelte';
  import ModeIcon from '../components/ModeIcon.svelte';
  import DuelVerdictCard from '../components/DuelVerdictCard.svelte';

  const MODE_LABEL: Record<string, string> = {
    'flag-to-country': 'modes.flagToCountry',
    'country-to-flag': 'modes.countryToFlag',
    'map-highlight': 'modes.mapHighlight',
    'map-locate': 'modes.mapLocate',
    'capital-to-country': 'modes.capitalToCountry',
    'country-to-capital': 'modes.countryToCapital',
    'country-to-languages': 'modes.countryToLanguages',
    'country-to-industry': 'modes.mainIndustries',
  };

  // Reactively read + decode the code from the hash query (svelte-spa-router's `router.querystring`
  // updates on navigation). `null` when neither leg is present; a failed decode carries its reason.
  const query = $derived(readDuelQuery(router.querystring));
  const decoded = $derived(query ? decodeDuel(query.code) : null);
  const payload = $derived(decoded?.ok ? decoded.payload : null);

  // A return leg must actually carry the opponent's score; otherwise it's as broken as a bad code.
  const isReturn = $derived(query?.leg === 'r' && !!payload?.opponentScore);
  const broken = $derived(!query || !payload || (query.leg === 'r' && !payload.opponentScore));

  // Warn (but allow — OQ6) when the challenge was built on a different dataset/app build.
  const versionMismatch = $derived(!!payload && payload.dataVersion !== duelDataVersion());

  function accept(p: DuelPayload): void {
    pendingDuel.set(p);
    pendingConfig.set(duelToRunConfig(p));
    push('/play');
  }

  // Rematch from the return screen: the challenger re-issues the same scope with a *fresh* seed
  // (dropped so `play.start` rolls one) and roles swap naturally — they play, then the Summary's
  // "Duel a friend" affordance lets them send the new challenge back.
  function rematch(p: DuelPayload): void {
    pendingDuel.set(null);
    pendingConfig.set({ ...duelToRunConfig(p), seed: undefined });
    push('/play');
  }

  function home(): void {
    push('/');
  }
</script>

<section class="duel">
  {#if broken}
    <div class="state">
      <Mascot pose="thinking" size={104} />
      <h1>{$t('duel.brokenTitle')}</h1>
      <p class="muted">{$t('duel.brokenBody')}</p>
      <button type="button" class="primary" onclick={home}>{$t('duel.home')}</button>
    </div>
  {:else if payload && isReturn && payload.opponentScore}
    <!-- Return leg: the original challenger opens their friend's result. Verdict from the
         challenger's perspective — their score vs the responder's. -->
    <h1 class="return-title">
      {payload.opponentName
        ? $t('duel.returnTitle', { name: payload.opponentName })
        : $t('duel.returnTitleAnon')}
    </h1>
    <DuelVerdictCard
      verdict={duelVerdict(payload.challengerScore, payload.opponentScore)}
      type={payload.type}
      youScore={payload.challengerScore}
      theirScore={payload.opponentScore}
      theirName={payload.opponentName ?? ''}
      onRematch={() => rematch(payload)}
      onHome={home}
    />
  {:else if payload}
    <!-- Incoming challenge. -->
    <div class="challenge">
      <Mascot pose="wave" animate="bounce-in" size={104} />
      <h1>
        {payload.challengerName
          ? $t('duel.incomingTitle', { name: payload.challengerName })
          : $t('duel.incomingTitleAnon')}
      </h1>

      <p class="scope">
        <span class="scope-ico" aria-hidden="true"><ModeIcon mode={payload.mode} /></span>
        <span>{$t(MODE_LABEL[payload.mode] ?? payload.mode)}</span>
        <span class="dot" aria-hidden="true">·</span>
        <span>{$t(`sessionType.${payload.type}`)}</span>
        <span class="dot" aria-hidden="true">·</span>
        <span>
          {payload.subregion
            ? $localizedRegion(payload.subregion)
            : payload.region
              ? $localizedRegion(payload.region)
              : $t('duel.scopeWorld')}
        </span>
      </p>

      <p class="target">
        {payload.type === 'blitz'
          ? $t('duel.targetPoints', { score: payload.challengerScore.primary.toLocaleString() })
          : $t('duel.targetScore', { score: payload.challengerScore.primary.toLocaleString() })}
      </p>

      <p class="identical">{$t('duel.identical')}</p>

      {#if versionMismatch}
        <p class="warning" role="alert">{$t('duel.versionWarning')}</p>
      {/if}

      <div class="actions">
        <button type="button" class="primary" onclick={() => accept(payload)}>
          <Icon name="swords" size="1em" />
          {$t('duel.accept')}
        </button>
        <button type="button" class="ghost" onclick={home}>{$t('duel.home')}</button>
      </div>
      <p class="muted note">{$t('duel.selfReported')}</p>
    </div>
  {/if}
</section>

<style>
  .duel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 640px;
    margin-inline: auto;
    width: 100%;
  }

  .state,
  .challenge {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.7rem;
    padding: 1rem;
  }

  h1 {
    margin: 0;
    font-size: 1.4rem;
  }

  .return-title {
    text-align: center;
    margin-bottom: 0.5rem;
  }

  .muted {
    color: var(--color-muted);
    margin: 0;
  }

  .scope {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.4rem;
    margin: 0;
    color: var(--color-muted);
    font-weight: 600;
  }

  .scope-ico {
    display: inline-flex;
    width: 1.2rem;
    height: 1.2rem;
    color: var(--color-accent);
  }

  .dot {
    opacity: 0.6;
  }

  .target {
    margin: 0;
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--color-accent-strong);
  }

  .identical {
    margin: 0;
    color: var(--color-muted);
  }

  .warning {
    margin: 0;
    padding: 0.5rem 0.9rem;
    border-radius: var(--radius);
    background: var(--color-wrong-bg, rgb(220 80 60 / 12%));
    color: var(--color-wrong);
    font-weight: 600;
    font-size: 0.9rem;
  }

  .note {
    font-size: 0.8rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.6rem;
    margin-top: 0.3rem;
  }

  .actions button,
  .state button {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.6rem 1.5rem;
    border-radius: 999px;
    font-weight: 700;
    border: 2px solid transparent;
    transition:
      transform 0.12s ease,
      box-shadow 0.12s ease;
  }

  .primary {
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    box-shadow: var(--shadow-chunky);
  }

  .primary:hover {
    transform: translateY(-2px);
  }

  .primary:active {
    transform: translateY(2px);
    box-shadow: var(--shadow-chunky-press);
  }

  .ghost {
    background: transparent;
    border-color: var(--color-border);
    color: var(--color-text);
  }

  @media (prefers-reduced-motion: reduce) {
    .actions button,
    .state button {
      transition: none;
    }

    .primary:hover {
      transform: none;
    }
  }
</style>
