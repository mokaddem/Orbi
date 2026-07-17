<script lang="ts">
  // The Grandmaster Challenge invitation card (Phase 45 ⑥). A ceremonial dark-teal card shown on
  // **Home only**, and only when the player has ≥ 1 attemptable family × continent (unlocked,
  // uncertified, not spent today — see `availableChallenges`). It's a *discovery* surface, in case
  // the player misses the quiet per-cell "prove it" crown on Progress; the Progress launch mechanic
  // is unchanged.
  //
  // Purely presentational: the caller (Home) owns visibility + the click routing (exactly one
  // available → its offer modal; more than one → Progress's World Mastery panel), reacting to
  // `onenter`. Styled with the arena's `--g-*` tokens (defined on :root) so it reads as a preview of
  // the dark-teal gauntlet it leads into, distinct from the light Orbi cards around it.
  import { t } from '../../i18n';
  import ChallengerOrbi from './ChallengerOrbi.svelte';

  let { onenter }: { onenter: () => void } = $props();
</script>

<div class="gm-invite" data-testid="grandmaster-invite">
  <span class="crest" aria-hidden="true"><ChallengerOrbi size={52} /></span>
  <div class="text">
    <span class="badge">{$t('challenge.invite.available')}</span>
    <h2 class="title">{$t('challenge.invite.title')}</h2>
    <p class="body">{$t('challenge.invite.body')}</p>
  </div>
  <button type="button" class="cta" onclick={onenter}>{$t('challenge.invite.cta')}</button>
</div>

<style>
  /* Dark-teal "entry-card" ground, a hairline gold-teal rim, and a soft deep shadow — a departure
     from the flat light Orbi cards, previewing the arena. Lays out as crest · text · CTA on a row,
     wrapping the CTA full-width under the text on narrow screens. */
  .gm-invite {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
    padding: 1rem 1.15rem;
    color: var(--g-ink);
    background: var(--g-entry);
    border: 1px solid var(--g-line);
    border-radius: var(--radius);
    box-shadow:
      0 10px 28px rgb(6 20 18 / 34%),
      inset 0 1px 0 rgb(255 255 255 / 8%);
  }

  .crest {
    flex: 0 0 auto;
    display: inline-flex;
  }

  .text {
    flex: 1 1 12rem;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  /* Gold "Available today" pill — the earned, time-boxed cue (the daily cooldown is per run). */
  .badge {
    align-self: flex-start;
    padding: 0.12rem 0.55rem;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--g-gold);
    background: color-mix(in oklab, var(--g-gold), transparent 88%);
    border: 1px solid color-mix(in oklab, var(--g-gold), transparent 62%);
    border-radius: 999px;
  }

  /* Gold gradient-clip ceremonial title in the reserved serif display face (as the offer modal). */
  .title {
    margin: 0.15rem 0 0;
    font-family: var(--g-display);
    font-size: 1.35rem;
    font-weight: 700;
    line-height: 1.15;
    background: var(--gold-metal);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .body {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.35;
    color: var(--g-dim);
  }

  /* The gold CTA mirrors the offer modal's Accept button — a chunky gold pill with the drop shadow. */
  .cta {
    flex: 0 0 auto;
    padding: 0.7rem 1.3rem;
    color: #4a2f00;
    background: var(--g-cta);
    border: none;
    border-radius: 999px;
    font-weight: 800;
    font-size: 0.95rem;
    box-shadow: var(--g-cta-shadow);
    cursor: pointer;
    transition: filter 0.12s ease;
  }

  .cta:hover {
    filter: brightness(1.04);
  }

  .cta:active {
    transform: translateY(2px);
    box-shadow: 0 2px 0 #9c7328;
  }

  .cta:focus-visible {
    outline: 2px solid var(--g-gold);
    outline-offset: 3px;
  }

  /* On a narrow phone the CTA drops below the text and spans the card for an easy tap target. */
  @media (max-width: 460px) {
    .cta {
      flex: 1 1 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cta {
      transition: none;
    }

    .cta:active {
      transform: none;
    }
  }
</style>
