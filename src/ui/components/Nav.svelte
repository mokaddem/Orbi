<script lang="ts">
  import { router } from 'svelte-spa-router';
  import { t } from '../../i18n';
  import { navLinks, bottomTabs } from '../routes';
  import { play as playStore, playFabAction } from '../stores/game';
  import Icon from './Icon.svelte';
  import Mascot from './Mascot.svelte';
  import LanguageSwitcher from './LanguageSwitcher.svelte';

  // Responsive primary nav (Phase 34). One component renders BOTH presentations — a left
  // sidebar rail for desktop and a bottom tab bar (with a raised Play FAB) for mobile — and CSS
  // shows exactly one per breakpoint (~860px). The hidden one is `display:none`, so it leaves
  // the accessibility tree entirely and only a single nav landmark is ever exposed.
  function isActive(href: string, current: string): boolean {
    const path = href.replace(/^#/, '') || '/';
    return path === '/' ? current === '/' : current === path || current.startsWith(`${path}/`);
  }

  // Rail composition: Play is a prominent button of its own, Settings is pinned to the foot, and
  // the remaining destinations flow between them.
  const play = navLinks.find((link) => link.primary)!;
  const railMain = navLinks.filter((link) => !link.primary && link.href !== '#/settings');
  const settings = navLinks.find((link) => link.href === '#/settings')!;

  // Eager FAB (Phase 43): on the Play setup screen (mobile), the raised Play FAB stands in for
  // the removed in-page "Start" button — it pulses and, on press, launches the game with the
  // current selections instead of navigating. It's "eager" only while the Play route is showing
  // setup and has published its launcher (`playFabAction`). Everywhere else the FAB is a plain
  // link. The desktop rail's Play link is untouched (this is the bottom-bar FAB only).
  const playEager = $derived(
    router.location === '/play' && $playStore.status === 'idle' && $playFabAction !== null,
  );

  function onFabClick(e: MouseEvent): void {
    if (playEager) {
      e.preventDefault(); // don't navigate — we're already on /play; start the game instead
      $playFabAction?.();
    }
  }
</script>

<!-- Desktop: left sidebar rail -->
<nav class="rail" aria-label={$t('nav.primary')}>
  <a class="rail-brand" href="#/">
    <Mascot pose="wave" size={34} />
    <span>{$t('app.title')}</span>
  </a>

  <a
    class="rail-play"
    class:active={isActive(play.href, router.location)}
    href={play.href}
    aria-current={isActive(play.href, router.location) ? 'page' : undefined}
  >
    <Icon name={play.icon} size={18} />
    <span>{$t(play.labelKey)}</span>
  </a>

  <ul class="rail-links">
    {#each railMain as link (link.href)}
      <li>
        <a
          class="rail-item"
          class:active={isActive(link.href, router.location)}
          href={link.href}
          aria-current={isActive(link.href, router.location) ? 'page' : undefined}
        >
          <Icon name={link.icon} size={19} />
          <span>{$t(link.labelKey)}</span>
        </a>
      </li>
    {/each}
  </ul>

  <div class="rail-foot">
    <a
      class="rail-item"
      class:active={isActive(settings.href, router.location)}
      href={settings.href}
      aria-current={isActive(settings.href, router.location) ? 'page' : undefined}
    >
      <Icon name={settings.icon} size={19} />
      <span>{$t(settings.labelKey)}</span>
    </a>
    <LanguageSwitcher />
  </div>
</nav>

<!-- Mobile: bottom tab bar with a raised centre Play FAB -->
<nav class="bottombar" aria-label={$t('nav.primary')}>
  {#each bottomTabs as link (link.href)}
    {#if link.primary}
      <a
        class="tab tab-fab"
        class:active={isActive(link.href, router.location)}
        class:eager={playEager}
        href={link.href}
        aria-current={isActive(link.href, router.location) ? 'page' : undefined}
        onclick={onFabClick}
      >
        <span class="fab-disc"><Icon name={link.icon} size={24} /></span>
        <span class="tab-label">{$t(link.labelKey)}</span>
      </a>
    {:else}
      <a
        class="tab"
        class:active={isActive(link.href, router.location)}
        href={link.href}
        aria-current={isActive(link.href, router.location) ? 'page' : undefined}
      >
        <span class="tab-ico"><Icon name={link.icon} size={22} /></span>
        <span class="tab-label">{$t(link.labelKey)}</span>
      </a>
    {/if}
  {/each}
</nav>

<style>
  /* ---- Desktop rail (shown ≥860px) ---------------------------------------------------- */
  .rail {
    display: none;
  }

  .rail-brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.6rem 0.9rem;
    font-weight: 800;
    font-size: 1.25rem;
    color: var(--color-accent);
  }

  .rail-brand:hover {
    text-decoration: none;
  }

  /* The rail's prominent Play button — the chunky teal pill, echoing the mobile FAB. */
  .rail-play {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.7rem 1rem;
    margin-bottom: 0.6rem;
    border-radius: 999px;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    font-weight: 800;
    font-size: 1rem;
    box-shadow: var(--shadow-chunky);
    transition:
      transform 0.08s ease,
      box-shadow 0.08s ease;
  }

  .rail-play:hover {
    text-decoration: none;
  }

  .rail-play:active {
    transform: translateY(2px);
    box-shadow: var(--shadow-chunky-press);
  }

  .rail-links {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .rail-item {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.55rem 0.8rem;
    border-radius: 14px;
    color: var(--color-muted);
    font-weight: 700;
  }

  .rail-item:hover {
    text-decoration: none;
    background: var(--color-accent-weak);
    color: var(--color-accent-strong);
  }

  .rail-item.active {
    color: var(--color-accent-strong);
    background: var(--color-accent-weak);
  }

  .rail-foot {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding-top: 0.6rem;
    border-top: 1px solid var(--color-border);
  }

  /* ---- Mobile bottom tab bar (shown <860px) ------------------------------------------- */
  /* Bottom tab bar: a structural bottom row of the app-shell flex column (not `position: fixed`),
     so it can't detach during an iOS momentum scroll — the scroll lives in `.content` above it. */
  .bottombar {
    display: flex;
    flex: 0 0 auto;
    /* Own stacking context above `.content`, so the raised Play FAB (which overflows up out of the
       bar) is never clipped by the scrolling content region — notably on iOS, where the scroll
       region is composited on its own layer. */
    position: relative;
    z-index: 2;
    justify-content: space-around;
    align-items: stretch;
    height: calc(var(--bottombar-h) + env(safe-area-inset-bottom, 0px));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    box-shadow: 0 -2px 14px -8px rgb(18 49 48 / 22%);
  }

  .tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.15rem;
    padding: 0.4rem 0.25rem;
    color: var(--color-muted);
    font-weight: 700;
  }

  .tab:hover {
    text-decoration: none;
  }

  .tab-label {
    font-size: 0.68rem;
    letter-spacing: 0.01em;
  }

  .tab.active {
    color: var(--color-accent-strong);
  }

  /* Active-tab indicator: an accent-weak pill behind the icon. The active *colour* shift alone
     (muted → accent-strong) was too subtle to read on a phone, so mirror the desktop rail's
     accent-weak active background — both presentations now mark the current page the same way. */
  .tab-ico {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 26px;
    border-radius: 999px;
    transition: background 0.12s ease;
  }

  .tab.active .tab-ico {
    background: var(--color-accent-weak);
  }

  /* Raised centre FAB: a chunky teal disc that lifts above the bar, with its label tucked
     under the bar's lip like the flanking tabs. */
  .tab-fab {
    color: var(--color-accent-strong);
  }

  .fab-disc {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 54px;
    height: 54px;
    margin-top: -26px;
    border-radius: 50%;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border: 4px solid var(--color-surface);
    box-shadow: var(--shadow-float);
    transition: transform 0.1s ease;
  }

  .tab-fab:active .fab-disc {
    transform: scale(0.94);
  }

  .tab-fab.active .fab-disc {
    box-shadow:
      var(--shadow-float),
      0 0 0 3px var(--color-accent-weak);
  }

  /* Eager state (Phase 43): on the Play setup screen this FAB replaces the removed in-page
     "Start" button, so it grows a touch and breathes — an expanding accent ring — to invite the
     tap. Pressing it launches the game (see Nav script / Play.svelte). */
  .tab-fab.eager .fab-disc {
    width: 60px;
    height: 60px;
    margin-top: -30px;
    animation: fab-eager 1.6s ease-in-out infinite;
  }

  /* Crisp press feedback while eager (the pulse would otherwise own `transform`). */
  .tab-fab.eager:active .fab-disc {
    animation: none;
    transform: scale(0.94);
  }

  @keyframes fab-eager {
    0% {
      transform: scale(1);
      box-shadow:
        var(--shadow-float),
        0 0 0 0 rgb(16 165 160 / 45%);
    }
    50% {
      transform: scale(1.09);
      box-shadow:
        var(--shadow-float),
        0 0 0 10px rgb(16 165 160 / 0%);
    }
    100% {
      transform: scale(1);
      box-shadow:
        var(--shadow-float),
        0 0 0 0 rgb(16 165 160 / 0%);
    }
  }

  /* ---- Breakpoint switch -------------------------------------------------------------- */
  @media (min-width: 860px) {
    .rail {
      display: flex;
      flex-direction: column;
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      width: var(--rail-width);
      padding: 1.1rem 0.9rem 1.2rem;
      background: var(--color-surface);
      border-right: 1px solid var(--color-border);
      overflow-y: auto;
    }

    .bottombar {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rail-play,
    .fab-disc {
      transition: none;
    }

    /* Keep the eager FAB's larger size, but drop the breathing pulse. */
    .tab-fab.eager .fab-disc {
      animation: none;
    }
  }
</style>
