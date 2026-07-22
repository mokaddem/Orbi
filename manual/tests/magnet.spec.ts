import { test } from '@playwright/test';

/**
 * MAP MAGNET-PULL LAB (manual, touch)
 * -----------------------------------
 * Runs under Pixel-5 emulation, so the map reports a COARSE pointer and uses the wider TOUCH snap
 * radii. Both tests mount the *real* interactive WorldMap with a micro-state as the asked country
 * (so answer-accept leniency is in play) and drive it exactly as a finger would.
 *
 *   sweep — synthesizes taps at growing offsets from a micro-state's aim-dot in 8 directions and
 *           prints the *effective magnet radius* (in logical 980×500 units) per country. This is the
 *           number to compare against the caps in src/ui/components/WorldMap.svelte:
 *             SNAP_CAP=58  DOT_SNAP_CAP=26  TARGET_ACCEPT_CAP=50   (coarse/touch values)
 *
 *   feel  — opens the map with a live HUD (target · last pick · tap-offset) and target-switcher
 *           buttons, so you can tap around by hand and feel where the pull grabs vs. lets go.
 *           The window stays open until you close it.
 *
 * Run:   npm run magnet:sweep
 *        npm run magnet:feel
 *        MAGNET_TARGET=LI npm run magnet:feel          # start on a given micro-state
 *        MAGNET_FOCUS=IT,FR,CH,AT,SI npm run magnet:sweep   # frame a region instead of the world
 *        MAGNET_ONLY=VA,MC,LI npm run magnet:sweep     # probe only these
 *
 * Tune by editing the caps in WorldMap.svelte, then re-run. (World framing = the hardest case:
 * micro-states are tiny and their dots crowd together; a region focus spreads them out.)
 */

const MICROS = ['VA', 'MC', 'SM', 'LI', 'AD', 'MT', 'SG', 'BH', 'GD', 'KN', 'MV', 'NR', 'TV'];

async function initLab(page: import('@playwright/test').Page, focus: string[] | null) {
  await page.goto('/');
  await page.waitForSelector('#app', { state: 'attached' });
  await page.waitForTimeout(300);

  await page.evaluate(async (focusIsos) => {
    const w = window as any;
    const H = await import('/manual/harness-magnet.ts');
    w.__H = H;
    w.__features = await H.loadCountryFeatures();

    document.body.innerHTML = '';
    document.body.style.margin = '0';
    const root = document.createElement('div');
    root.id = 'lab-map';
    root.style.cssText = 'position:fixed;inset:0;background:#0a1a2f;';
    document.body.appendChild(root);
    w.__root = root;
    w.__focus = focusIsos;
    w.__pick = null;
    w.__lastPick = null;

    // (Re)mount the interactive map with `iso` as the asked country.
    w.__mountTarget = (iso: string) => {
      if (w.__app) w.__H.unmount(w.__app);
      root.innerHTML = '';
      w.__pick = null;
      w.__app = w.__H.mount(w.__H.WorldMap, {
        target: root,
        props: {
          features: w.__features,
          interactive: true,
          disabled: false,
          projection: 'naturalEarth',
          answerIso: iso,
          focusIsos: w.__focus,
          questionKey: iso,
          onpick: (picked: string) => {
            w.__pick = picked;
            w.__lastPick = picked;
          },
        },
      });
    };

    // In-page sweep: for each direction, walk outward from the dot and record the largest
    // *contiguous* offset (from 0) still accepted as `iso`. Taps are synthetic clicks dispatched
    // at exact points — the caps live in matchMedia (coarse), independent of the event kind, so
    // this measures the real resolve math. Returns per-direction radii + the first "steal".
    w.__sweep = (iso: string, distances: number[], angleCount: number) => {
      const g = root.querySelector('g.zoom-layer') as SVGGElement | null;
      const dot = root.querySelector(`circle[data-iso="${iso}"][data-hit="dot"]`) as SVGCircleElement | null;
      if (!g || !dot) return { iso, ok: false };
      const m = g.getScreenCTM();
      if (!m) return { iso, ok: false };
      const cx = parseFloat(dot.getAttribute('cx') || 'NaN');
      const cy = parseFloat(dot.getAttribute('cy') || 'NaN');
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) return { iso, ok: false };
      const toScreen = (lx: number, ly: number) => ({ x: m.a * lx + m.c * ly + m.e, y: m.b * lx + m.d * ly + m.f });
      const vw = window.innerWidth, vh = window.innerHeight;

      const dirs: { angleDeg: number; acceptRadius: number; steal: string | null; stealDist: number | null }[] = [];
      for (let a = 0; a < angleCount; a++) {
        const ang = (a / angleCount) * 2 * Math.PI;
        const ux = Math.cos(ang), uy = Math.sin(ang);
        let acceptRadius = -1, contiguous = true, steal: string | null = null, stealDist: number | null = null;
        for (const d of distances) {
          const p = toScreen(cx + ux * d, cy + uy * d);
          if (p.x < 0 || p.y < 0 || p.x > vw || p.y > vh) break; // off-screen → stop this ray
          const el = document.elementFromPoint(p.x, p.y);
          if (!el) break;
          w.__pick = null;
          el.dispatchEvent(new MouseEvent('click', { clientX: p.x, clientY: p.y, bubbles: true, cancelable: true, composed: true }));
          const accepted = w.__pick === iso;
          if (accepted && contiguous) {
            acceptRadius = d;
          } else if (contiguous) {
            contiguous = false;
            steal = w.__pick; // what grabbed the tap just past the accept edge (null = clear miss)
            stealDist = d;
          }
        }
        dirs.push({ angleDeg: Math.round((a / angleCount) * 360), acceptRadius, steal, stealDist });
      }

      const radii = dirs.map((x) => x.acceptRadius).filter((r) => r >= 0).sort((p, q) => p - q);
      const med = radii.length ? radii[Math.floor(radii.length / 2)] : -1;
      return {
        iso,
        ok: true,
        scale: Math.hypot(m.a, m.b), // screen px per logical unit (framing context)
        min: radii.length ? radii[0] : -1,
        max: radii.length ? radii[radii.length - 1] : -1,
        med,
        dirs,
      };
    };
  }, focus);
}

test('magnet sweep (touch) — effective magnet radius per micro-state', async ({ page }) => {
  const focus = process.env.MAGNET_FOCUS ? process.env.MAGNET_FOCUS.split(',') : null;
  const only = process.env.MAGNET_ONLY ? process.env.MAGNET_ONLY.split(',') : MICROS;

  await initLab(page, focus);

  const distances: number[] = [];
  for (let d = 0; d <= 80; d += 4) distances.push(d);

  const rows: any[] = [];
  for (const iso of only) {
    await page.evaluate((i) => (window as any).__mountTarget(i), iso);
    await page.waitForTimeout(200);
    rows.push(await page.evaluate(
      ({ iso, distances, angles }) => (window as any).__sweep(iso, distances, angles),
      { iso, distances, angles: 8 },
    ));
  }

  const line = '─'.repeat(78);
  console.log('\n' + line);
  console.log('MAGNET SWEEP — effective accept radius in LOGICAL units (980×500 surface)');
  console.log(`framing: ${focus ? focus.join(',') : 'WORLD'}   ·   coarse caps: DOT_SNAP=26  TARGET_ACCEPT=50  SNAP=58`);
  console.log(line);
  console.log('iso   accept radius (min / med / max)   px/logical   steals just past the edge');
  console.log(line);
  for (const r of rows) {
    if (!r.ok) {
      console.log(`${r.iso.padEnd(5)} — no aim-dot rendered (not a micro-state here / no geometry)`);
      continue;
    }
    const steals = r.dirs
      .filter((d: any) => d.steal)
      .map((d: any) => `${d.steal}@${d.stealDist}`)
      .slice(0, 4)
      .join(' ');
    const clearMiss = r.dirs.some((d: any) => d.steal === null && d.stealDist != null);
    console.log(
      `${r.iso.padEnd(5)} ${String(r.min).padStart(3)} / ${String(r.med).padStart(3)} / ${String(r.max).padStart(3)}` +
        `${''.padEnd(13)}${r.scale.toFixed(2).padStart(5)}      ${steals || '—'}${clearMiss ? '  (+clear-miss)' : ''}`,
    );
  }
  console.log(line);
  console.log('Read: med ≈ TARGET_ACCEPT_CAP where no big neighbour is near; a low value in some');
  console.log('direction means a neighbour/host body steals the tap before the accept radius.');
  console.log(line + '\n');
});

test('magnet feel (touch) — tap around a micro-state by hand', async ({ page }) => {
  const target = process.env.MAGNET_TARGET || 'VA';
  const focus = process.env.MAGNET_FOCUS ? process.env.MAGNET_FOCUS.split(',') : null;

  await initLab(page, focus);

  await page.evaluate(({ target, micros }) => {
    const w = window as any;
    let curTarget = target;
    let lastLogical: { x: number; y: number } | null = null;

    const hud = document.createElement('div');
    hud.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:30;padding:10px 12px;background:rgba(0,0,0,.72);' +
      'color:#fff;font:13px system-ui,sans-serif;display:flex;gap:10px;flex-wrap:wrap;align-items:center;';
    const info = document.createElement('div');
    info.style.cssText = 'min-width:260px;font-variant-numeric:tabular-nums;';
    hud.appendChild(info);
    document.body.appendChild(hud);

    function targetDist(): number | null {
      const dot = w.__root.querySelector(`circle[data-iso="${curTarget}"][data-hit="dot"]`);
      if (!dot || !lastLogical) return null;
      const cx = +dot.getAttribute('cx'), cy = +dot.getAttribute('cy');
      return Math.hypot(cx - lastLogical.x, cy - lastLogical.y);
    }
    function refresh() {
      const pick = w.__lastPick;
      const d = targetDist();
      const hit = pick === curTarget;
      const color = pick ? (hit ? '#4ade80' : '#f87171') : '#9aa4b2';
      info.innerHTML =
        `Target <b>${curTarget}</b> &nbsp;·&nbsp; last pick ` +
        `<b style="color:${color}">${pick || '—'}</b> ${pick ? (hit ? '✓' : '✗') : ''} ` +
        `&nbsp;·&nbsp; tap-offset <b>${d == null ? '—' : d.toFixed(1)}</b> logical`;
    }

    // Capture-phase: runs before the map's own handler, so we log where the tap landed (logical),
    // then read the resulting pick on the next tick (after resolvePick has run).
    w.__root.addEventListener(
      'click',
      (e: MouseEvent) => {
        const g = w.__root.querySelector('g.zoom-layer');
        if (g) {
          const m = (g.getScreenCTM() as DOMMatrix).inverse();
          lastLogical = { x: m.a * e.clientX + m.c * e.clientY + m.e, y: m.b * e.clientX + m.d * e.clientY + m.f };
        }
        setTimeout(refresh, 0);
      },
      true,
    );

    micros.forEach((iso: string) => {
      const b = document.createElement('button');
      b.textContent = iso;
      b.style.cssText =
        'padding:5px 8px;border:0;border-radius:6px;cursor:pointer;font:12px system-ui;' +
        'background:#334155;color:#fff;';
      b.onclick = () => {
        curTarget = iso;
        w.__mountTarget(iso);
        w.__lastPick = null;
        lastLogical = null;
        setTimeout(refresh, 60);
      };
      hud.appendChild(b);
    });

    w.__mountTarget(curTarget);
    setTimeout(refresh, 60);
  }, { target, micros: MICROS });

  await page.waitForEvent('close', { timeout: 0 });
});
