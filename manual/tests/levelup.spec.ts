import { test } from '@playwright/test';

/**
 * LEVEL-UP ANIMATION LAB (manual)
 * -------------------------------
 * Mounts the *real* SessionXpCard with a forced rank roll-over, so you can watch the level-up
 * animation on demand — no need to grind XP across real games. In-page controls let you replay,
 * step through every rank tier (the medal motion differs per band: bronze/silver/gold/platinum/
 * crystal), and toggle reduced-motion to compare.
 *
 * Tune by editing src/ui/components/SessionXpCard.svelte (REVEAL_HOLD_MS / STEP_MS / TWEEN_MS, the
 * `.track.rolled` transition, the confetti/badge-pop). Vite HMR reloads; hit "Replay" to re-watch.
 *
 * Run:   npm run levelup            (from this manual/ folder)
 *        LEVELUP_RANK=9 npm run levelup   # open straight on a given target rank (1..14)
 *
 * The window stays open until you close it.
 */
test('level-up animation lab', async ({ page }) => {
  const startRank = Number(process.env.LEVELUP_RANK) || 1;

  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });
  await page.waitForTimeout(400); // let app.css theme vars + i18n settle

  await page.evaluate(async (initialRank) => {
    const H = await import('/manual/harness-levelup.ts');
    const { mount, unmount, rankForXp, RANKS, SessionXpCard } = H as any;

    // --- reset the page to a bare stage (keeps <html>/<body> theme classes + app.css vars) ---
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.style.minHeight = '100vh';
    document.body.style.background = 'var(--bg, #0b1220)';

    const bar = document.createElement('div');
    bar.style.cssText =
      'position:sticky;top:0;z-index:10;display:flex;gap:6px;flex-wrap:wrap;align-items:center;' +
      'padding:8px;background:rgba(0,0,0,.55);color:#fff;font:13px system-ui,sans-serif;';
    document.body.appendChild(bar);

    const stage = document.createElement('div');
    stage.style.cssText = 'display:flex;justify-content:center;padding:28px 12px 60px;';
    document.body.appendChild(stage);

    const label = document.createElement('span');
    label.style.cssText = 'margin-left:auto;opacity:.85;font-variant-numeric:tabular-nums;';

    let rankIdx = Math.max(1, Math.min(RANKS.length - 1, initialRank));
    let reduce = false;
    let host: HTMLDivElement | null = null;
    let app: unknown = null;

    // A representative run that crosses the threshold, so the tally has a few rows to land.
    function buildProps(toIdx: number) {
      const to = Math.max(1, Math.min(RANKS.length - 1, toIdx));
      const startXp = RANKS[to].minXp - 1; // 1 XP shy of the threshold → previous rank, near full
      const breakdown = [
        { key: 'correct', count: 9, xp: 90 },
        { key: 'questions', count: 10, xp: 30 },
        { key: 'sessions', count: 1, xp: 25 },
        { key: 'streakBonus', count: 4, xp: 40 },
      ];
      const earned = breakdown.reduce((s, r) => s + r.xp, 0);
      const startProgress = rankForXp(startXp);
      const progress = rankForXp(startXp + earned);
      return {
        earned,
        breakdown,
        progress,
        startProgress,
        startFraction: startProgress.fraction,
        rankedUp: progress.rank.index > startProgress.rank.index,
        reduceMotion: reduce,
      };
    }

    function render() {
      if (app) unmount(app);
      if (host) host.remove();
      host = document.createElement('div');
      host.style.cssText = 'width:100%;max-width:440px;';
      stage.appendChild(host);
      const p = buildProps(rankIdx);
      app = mount(SessionXpCard, { target: host, props: p });
      label.textContent =
        `→ ${p.progress.rank.key}  ·  rank ${p.progress.rank.index + 1}/${RANKS.length}  ·  ` +
        `+${p.earned} XP  ·  ${p.rankedUp ? 'RANK UP' : 'no cross'}`;
    }

    function btn(txt: string, fn: () => void) {
      const b = document.createElement('button');
      b.textContent = txt;
      b.style.cssText =
        'padding:6px 10px;border-radius:7px;border:0;background:#2563eb;color:#fff;' +
        'cursor:pointer;font:13px system-ui,sans-serif;';
      b.onclick = fn;
      bar.appendChild(b);
      return b;
    }

    btn('⟳ Replay', render);
    btn('◀ tier', () => {
      rankIdx = rankIdx <= 1 ? RANKS.length - 1 : rankIdx - 1;
      render();
    });
    btn('tier ▶', () => {
      rankIdx = rankIdx >= RANKS.length - 1 ? 1 : rankIdx + 1;
      render();
    });
    const rm = btn('reduce-motion: off', () => {
      reduce = !reduce;
      rm.textContent = 'reduce-motion: ' + (reduce ? 'on' : 'off');
      render();
    });
    bar.appendChild(label);

    (window as any).__lab = { render, setRank: (i: number) => ((rankIdx = i), render()) };
    render();
  }, startRank);

  // Keep the lab open until you close the browser window.
  await page.waitForEvent('close', { timeout: 0 });
});
