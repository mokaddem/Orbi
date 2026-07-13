<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import earcut from 'earcut';
  import { geoArea, geoContains } from 'd3-geo';
  import type { CountryFeature } from '../../data';
  import { t } from '../../i18n';
  import Icon from './Icon.svelte';
  import { nearestCountryWithinCap, type CentroidTarget } from './map-hit';
  import {
    TEX_W,
    TEX_H,
    appendBorderSegments,
    fitDistanceForAngularRadius,
    largestPolygonCentroid,
    lonLatToTexPx,
    lonLatToVec3,
    polygonsOf,
    robustRegionFrame,
    splitRingAtAntimeridian,
    vec3ToLonLat,
  } from './globe-geo';

  // WebGL "planet" renderer (Phase 38) — the globe sibling of WorldMap.
  //
  // A single sphere is textured from an offscreen equirectangular canvas drawn from the
  // real country geometry (redrawn only when the highlight/pick/reveal changes, never per
  // frame). OrbitControls gives damped, inertial drag-spin + dolly zoom; a short camera
  // slerp flies the prompt/answer country to the front on each question. Picking is a
  // raycast onto the sphere → lon/lat → exact `geoContains`, with a micro-state aim-assist
  // and an ocean-gap snap layered on top (Stage 2) so tiny countries stay selectable and a
  // near-miss still resolves; the back hemisphere is unclickable by construction.
  //
  // Stage 2 also adds billboarded reveal/picked name labels, region fit-distance framing,
  // the +/−/reset control cluster, and a gentle idle spin on the (non-interactive) preview.
  let {
    features,
    highlightIso = null,
    pickedIso = null,
    pickedLabel = null,
    revealIso = null,
    revealLabel = null,
    focusIsos = null,
    interactive = false,
    disabled = false,
    reduceMotion = false,
    questionKey = null,
    onpick,
  }: {
    features: Map<string, CountryFeature>;
    highlightIso?: string | null;
    pickedIso?: string | null;
    pickedLabel?: string | null;
    revealIso?: string | null;
    revealLabel?: string | null;
    focusIsos?: string[] | null;
    interactive?: boolean;
    disabled?: boolean;
    reduceMotion?: boolean;
    questionKey?: string | number | null;
    onpick?: (iso2: string) => void;
  } = $props();

  // Camera distances (globe radius = 1) and interaction tuning.
  const WORLD_DIST = 3.2;
  const COUNTRY_DIST = 2.2; // framing a single prompt/answer country
  const MIN_DIST = 1.45;
  const MAX_DIST = 5.5;
  const FLY_MS = 900;
  const ZOOM_STEP = 1.5;
  const PICK_MOVE = 6; // px a pointer may drift and still count as a click, not a drag
  const MICRO_CAP = 16; // px aim-assist radius around a micro-state's screen centroid
  const OCEAN_CAP = 42; // px snap radius for a near-miss on open water
  const MICRO_STER = 3e-5; // geoArea (steradians) below which a country is "micro" (aim-assisted)
  const AUTOROTATE_SPEED = 0.5;
  // Drag-spin speed at the world view; scaled down as the camera dollies in so a zoomed-in
  // spin isn't way too fast. The surface travel per drag-pixel is constant when
  // rotateSpeed ∝ (distance − globe radius) — the `−1` matters up close (near the surface a
  // small rotation sweeps a lot of screen), so this falls off much faster than ∝ distance.
  const ROTATE_SPEED = 0.62;
  const ROTATE_SPEED_MIN = 0.07;
  const BORDER_R = 1.0015; // radius of the vector border lines, just above the fill surface
  const LIFT_MAX = 1.026; // radius the hovered country's raised tile lifts to
  const LIFT_MIN = 1.003; // resting radius (just clear of the fill, so it settles unseen)
  const DOT_SIZE = 15; // base micro-state dot size (screen px)
  const DOT_HOVER_SIZE = 23; // micro-state dot size while hovered (pulses around this)

  interface Palette {
    water: string;
    land: string;
    border: string;
    highlight: string;
    correct: string;
    wrong: string;
    dot: string;
  }

  let container = $state<HTMLDivElement>();
  let failed = $state(false);

  // three.js objects (created on mount; not reactive state).
  let renderer: THREE.WebGLRenderer | undefined;
  let scene: THREE.Scene | undefined;
  let camera: THREE.PerspectiveCamera | undefined;
  let controls: OrbitControls | undefined;
  let earth: THREE.Mesh | undefined;
  let borders: THREE.LineSegments | undefined;
  let microDots: THREE.Points | undefined;
  let microDotMat: THREE.PointsMaterial | undefined;
  let microHover: THREE.Points | undefined; // single pulsing dot on the hovered micro-state
  let microHoverMat: THREE.PointsMaterial | undefined;
  let liftMesh: THREE.Mesh | undefined;
  let liftMat: THREE.MeshPhongMaterial | undefined;
  let revealSprite: THREE.Sprite | undefined;
  let pickedSprite: THREE.Sprite | undefined;
  let texture: THREE.CanvasTexture | undefined;
  let texCtx: CanvasRenderingContext2D | undefined;
  let palette: Palette;
  let raf = 0;
  // Non-reactive lookup caches: filled once in onMount, only read afterward. Plain
  // Map/Set are deliberate here — they never drive the UI, so SvelteMap/SvelteSet would
  // waste reactivity.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const centroids = new Map<string, [number, number]>();
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const microIsos = new Set<string>();
  // lon/lat bounding box [minLon, minLat, maxLon, maxLat] per country, for a cheap reject
  // before the (costly) `geoContains` on each hover frame. Antimeridian-spanning countries
  // get a full-width box so they're never wrongly rejected.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const bboxes = new Map<string, [number, number, number, number]>();

  // Hover-lift state (locate mode): the country under the pointer rises off the globe as a
  // raised tile. `hoverPointer` is the latest pointer position, resolved once per frame in
  // the render loop (throttling the raycast); `liftCurrent`/`liftTarget` drive the spring.
  let hoverIso: string | null = null;
  let hoverMicroIso: string | null = null; // micro-state whose dot the pointer is over
  let hoverPointer: [number, number] | null = null;
  let liftCurrent = 1;
  let liftTarget = 1;

  interface Fly {
    fromDir: THREE.Vector3;
    toDir: THREE.Vector3;
    fromDist: number;
    dist: number;
    t0: number;
    ms: number;
  }
  let fly: Fly | null = null;

  // Great-circle interpolation between two unit direction vectors (three's Vector3 has
  // `lerp` but no `slerp`). Near-parallel vectors fall back to a normalised lerp to avoid
  // the sin(θ)→0 blow-up.
  function slerpDir(a: THREE.Vector3, b: THREE.Vector3, tt: number): THREE.Vector3 {
    const dot = Math.min(1, Math.max(-1, a.dot(b)));
    if (dot > 0.9995) return a.clone().lerp(b, tt).normalize();
    const theta = Math.acos(dot) * tt;
    const rel = b.clone().addScaledVector(a, -dot).normalize();
    return a.clone().multiplyScalar(Math.cos(theta)).addScaledVector(rel, Math.sin(theta));
  }

  const easeInOut = (p: number): number =>
    p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const easeBack = (p: number): number => {
    const c = 1.4;
    return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
  };

  function prefersReduced(): boolean {
    if (reduceMotion) return true;
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function readPalette(): Palette {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string) => cs.getPropertyValue(name).trim();
    return {
      water: v('--map-water') || '#d3edf3',
      land: v('--map-land') || '#ecf7f4',
      border: v('--map-border') || '#bfded9',
      highlight: v('--map-highlight') || '#7fd9d3',
      correct: v('--color-correct') || '#1e9e5a',
      wrong: v('--color-wrong') || '#cf3b2c',
      dot: v('--color-accent-strong') || '#0b7e7a',
    };
  }

  function roundRect(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // --- Country texture -----------------------------------------------------------
  // The texture supplies the *fills* only; borders are crisp GPU vector lines (`borders`)
  // overlaid on the sphere, so they stay sharp at any zoom instead of blurring with the
  // raster (Phase 38 Stage 3, fix 5).
  function tracePolygons(geom: CountryFeature['geometry']): void {
    if (!texCtx) return;
    for (const poly of polygonsOf(geom)) {
      for (const ring of poly) {
        // Split antimeridian-crossing rings so no edge smears across the whole texture
        // (the old ±360 3-copy draw left the seam inside each copy → the polar band).
        for (const piece of splitRingAtAntimeridian(ring)) {
          texCtx.beginPath();
          piece.forEach(([lon, lat], i) => {
            const [x, y] = lonLatToTexPx(lon, lat);
            if (i) texCtx!.lineTo(x, y);
            else texCtx!.moveTo(x, y);
          });
          texCtx.closePath();
          texCtx.fill('evenodd');
        }
      }
    }
  }

  function drawTexture(): void {
    if (!texCtx || !texture) return;
    texCtx.clearRect(0, 0, TEX_W, TEX_H);
    texCtx.fillStyle = palette.water;
    texCtx.fillRect(0, 0, TEX_W, TEX_H);
    for (const [iso2, f] of features) {
      const isReveal = iso2 === revealIso;
      const isPicked = iso2 === pickedIso && iso2 !== revealIso;
      const isHighlight = iso2 === highlightIso;
      texCtx.fillStyle = isHighlight
        ? palette.highlight
        : isReveal
          ? palette.correct
          : isPicked
            ? palette.wrong
            : palette.land;
      tracePolygons(f.geometry);
    }
    texture.needsUpdate = true;
  }

  // The country a question wants to teach: the highlight prompt, or (once answered) the
  // locate reveal target — the country the camera re-frames to. Fresh locate questions have
  // neither. (The reveal target is marked by its name callout, not a pin.)
  function teachTarget(): string | null {
    return highlightIso ?? (disabled ? revealIso : null);
  }

  // --- Micro-state aim dots ------------------------------------------------------
  // Parity with the flat map (Phase 22): micro-states (Vatican, Monaco, Singapore…) are
  // nearly invisible and un-hittable, so each gets a visible constant-size dot at its
  // centroid. The dot set == the Stage-2 snap set (`microIsos`), so the visible dot *is*
  // the snappable target. Points with `sizeAttenuation:false` stay a fixed pixel size;
  // depth-tested against the sphere so back-hemisphere dots hide behind the globe.
  function makeDotTexture(): THREE.CanvasTexture {
    const s = 64;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d')!;
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2 - 7, 0, 2 * Math.PI);
    g.fillStyle = palette.dot;
    g.fill();
    g.lineWidth = 7;
    g.strokeStyle = '#fff';
    g.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Micro-state dots. Two cases:
  //  • map-highlight — a single dot on the highlighted country *if it is a micro-state*, so a
  //    speck like Vatican is visible when highlighted (owner request; parity with the flat map).
  //  • map-locate — the full micro-state set while answering, and once answered (muted); the
  //    reveal target's own dot is dropped, its place shown by the name callout instead.
  function updateMicroDots(): void {
    if (!microDots || !microDotMat) return;
    const highlightMicro = highlightIso && microIsos.has(highlightIso) ? highlightIso : null;
    const show = highlightMicro
      ? true
      : !highlightIso && (interactive || (disabled && !!revealIso));
    microDots.visible = show;
    if (!show) {
      setMicroHover(null);
      return;
    }
    const pos: number[] = [];
    if (highlightMicro) {
      const c = centroids.get(highlightMicro);
      if (c) pos.push(...lonLatToVec3(c[0], c[1], 1.01));
    } else {
      for (const iso of microIsos) {
        if (disabled && iso === revealIso) continue;
        const c = centroids.get(iso);
        if (!c) continue;
        pos.push(...lonLatToVec3(c[0], c[1], 1.01));
      }
    }
    const geo = microDots.geometry;
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setDrawRange(0, pos.length / 3);
    // Keep the highlight dot at full strength (it *is* the prompt); mute only answered locate.
    microDotMat.opacity = disabled && !highlightMicro ? 0.4 : 1;
  }

  // Highlight the micro-state dot the pointer is over with a single pulsing dot on top of
  // it (locate mode). The pulse animates in the render loop; here we just position it and
  // toggle visibility when the hovered micro-state changes.
  function setMicroHover(iso: string | null): void {
    if (iso === hoverMicroIso) return;
    hoverMicroIso = iso;
    if (!microHover) return;
    if (iso && centroids.has(iso)) {
      const [lon, lat] = centroids.get(iso)!;
      const geo = microHover.geometry;
      geo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute([...lonLatToVec3(lon, lat, 1.01)], 3),
      );
      microHover.visible = true;
    } else {
      microHover.visible = false;
    }
  }

  // --- Reveal / picked name callouts (billboarded sprites) -----------------------
  // A callout = a name pill + a downward leader stem + a tip dot, all drawn into one canvas
  // and anchored at the tip. The sprite billboards (screen-aligned), so the stem is always
  // vertical on screen and the tip lands *exactly* on the country's surface point, with the
  // pill floating above — the flat map's leader+label, on the globe (Phase 38 Stage 3).
  const PILL_WORLD = 0.13; // pill height in world units (tuned for the answer framing)
  function makeCallout(text: string, color: string, stem: number): THREE.Sprite {
    const font = 46;
    const pad = 18;
    const tip = 7;
    const measure = document.createElement('canvas').getContext('2d')!;
    measure.font = `600 ${font}px system-ui, sans-serif`;
    const pillW = Math.ceil(measure.measureText(text).width) + pad * 2;
    const pillH = font + pad * 2;
    const W = pillW;
    const H = pillH + stem + tip * 2;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    // Leader stem + tip dot first, so the pill draws over the stem's top.
    g.strokeStyle = color;
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(W / 2, pillH);
    g.lineTo(W / 2, H - tip);
    g.stroke();
    g.beginPath();
    g.arc(W / 2, H - tip, tip, 0, 2 * Math.PI);
    g.fillStyle = color;
    g.fill();
    // Pill.
    g.fillStyle = 'rgba(255,255,255,0.94)';
    roundRect(g, 1, 1, W - 2, pillH - 2, pillH / 2);
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = color;
    g.stroke();
    g.font = `600 ${font}px system-ui, sans-serif`;
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, W / 2, pillH / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
    );
    const scaleY = (PILL_WORLD * H) / pillH;
    sprite.scale.set((W / H) * scaleY, scaleY, 1);
    // Anchor the tip dot (canvas y = H − tip) on the surface point.
    sprite.center.set(0.5, tip / H);
    sprite.renderOrder = 10; // always legible, above the fills/borders/lift
    return sprite;
  }

  function disposeSprite(s: THREE.Sprite | undefined): void {
    if (!s) return;
    scene?.remove(s);
    (s.material.map as THREE.Texture | null)?.dispose();
    s.material.dispose();
  }

  function updateLabels(): void {
    if (!scene) return;
    disposeSprite(revealSprite);
    revealSprite = undefined;
    disposeSprite(pickedSprite);
    pickedSprite = undefined;
    // Reveal gets the taller stem, the wrong pick a shorter one, so the two pills clear
    // each other when the countries are adjacent (e.g. picked France / answer Spain).
    if (revealLabel && revealIso && centroids.has(revealIso)) {
      revealSprite = makeCallout(revealLabel, palette.correct, 84);
      const [lon, lat] = centroids.get(revealIso)!;
      revealSprite.position.copy(new THREE.Vector3(...lonLatToVec3(lon, lat, 1.01)));
      scene.add(revealSprite);
    }
    if (pickedLabel && pickedIso && pickedIso !== revealIso && centroids.has(pickedIso)) {
      pickedSprite = makeCallout(pickedLabel, palette.wrong, 40);
      const [lon, lat] = centroids.get(pickedIso)!;
      pickedSprite.position.copy(new THREE.Vector3(...lonLatToVec3(lon, lat, 1.01)));
      scene.add(pickedSprite);
    }
  }

  // --- Camera framing ------------------------------------------------------------
  function flyToDir(toDir: THREE.Vector3, dist: number): void {
    if (!camera) return;
    const clamped = Math.min(MAX_DIST, Math.max(MIN_DIST, dist));
    if (prefersReduced()) {
      camera.position.copy(toDir.clone().normalize().multiplyScalar(clamped));
      camera.lookAt(0, 0, 0);
      controls?.update();
      fly = null;
      return;
    }
    if (controls) controls.enabled = false;
    fly = {
      fromDir: camera.position.clone().normalize(),
      toDir: toDir.clone().normalize(),
      fromDist: camera.position.length(),
      dist: clamped,
      t0: performance.now(),
      ms: FLY_MS,
    };
  }

  function flyToLonLat(lon: number, lat: number, dist: number): void {
    flyToDir(new THREE.Vector3(...lonLatToVec3(lon, lat, 1)), dist);
  }

  function zoomBy(factor: number): void {
    if (!camera) return;
    const dir = camera.position.clone().normalize();
    flyToDir(dir, camera.position.length() * factor);
  }

  function resetView(): void {
    reframe();
  }

  // Re-frame on a new question: prompt/answer country to the front (highlight or answered
  // locate), else the active region fit to its angular span, else the whole world.
  function reframe(): void {
    if (!camera) return;
    const target = teachTarget();
    if (target && centroids.has(target)) {
      const [lon, lat] = centroids.get(target)!;
      flyToLonLat(lon, lat, COUNTRY_DIST);
      return;
    }
    if (focusIsos && focusIsos.length) {
      // Robust centre + angular radius over the members' *centroids*, trimming far
      // outliers (drops Russia-in-Europe) so the region stays framed — not recentred
      // over Asia with Europe at the limb.
      const members = focusIsos
        .map((iso) => centroids.get(iso))
        .filter((m): m is [number, number] => !!m);
      const frame = robustRegionFrame(members);
      if (frame) {
        flyToLonLat(frame.centre[0], frame.centre[1], fitDistanceForAngularRadius(frame.radius));
        return;
      }
    }
    flyToLonLat(0, 10, WORLD_DIST);
  }

  // --- Picking -------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downXY: [number, number] | null = null;

  // Project every *visible* (front-hemisphere) country centroid to canvas pixels, so the
  // pure `nearestCountryWithinCap` (shared with the flat map) can resolve aim-assist and
  // ocean snaps in the same screen space as the click.
  function collectTargets(rect: DOMRect): { all: CentroidTarget[]; micro: CentroidTarget[] } {
    const all: CentroidTarget[] = [];
    const micro: CentroidTarget[] = [];
    if (!camera) return { all, micro };
    const camDir = camera.position.clone().normalize();
    const v = new THREE.Vector3();
    for (const [iso2, [lon, lat]] of centroids) {
      v.set(...lonLatToVec3(lon, lat, 1));
      if (v.dot(camDir) <= 0.06) continue; // back hemisphere
      v.project(camera);
      const target: CentroidTarget = {
        iso2,
        cx: (v.x * 0.5 + 0.5) * rect.width,
        cy: (-v.y * 0.5 + 0.5) * rect.height,
      };
      all.push(target);
      if (microIsos.has(iso2)) micro.push(target);
    }
    return { all, micro };
  }

  // Country containing a lon/lat, with a cheap bounding-box reject before the O(ring)
  // `geoContains`. Shared by the click pick and the hover-lift resolver.
  function countryAtLonLat(lon: number, lat: number): string | null {
    for (const [iso2, f] of features) {
      const b = bboxes.get(iso2);
      if (b && (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3])) continue;
      if (geoContains(f, [lon, lat])) return iso2;
    }
    return null;
  }

  function onPointerDown(e: PointerEvent): void {
    downXY = [e.clientX, e.clientY];
  }
  function onPointerUp(e: PointerEvent): void {
    if (!downXY || !interactive || disabled || !renderer || !camera || !earth) {
      downXY = null;
      return;
    }
    const drift = Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]);
    downXY = null;
    if (drift > PICK_MOVE) return; // it was a drag-to-spin, not a pick

    const rect = renderer.domElement.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const { all, micro } = collectTargets(rect);

    // 1) micro-state aim-assist: a click near a tiny country's centroid wins (like the flat
    //    map's aim-dots sitting on top), so Vatican/Monaco/Singapore stay selectable.
    let iso = nearestCountryWithinCap(cx, cy, micro, MICRO_CAP);
    // 2) exact polygon hit under the pointer.
    if (!iso) {
      ndc.x = (cx / rect.width) * 2 - 1;
      ndc.y = -(cy / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(earth, false)[0];
      if (hit) {
        const [lon, lat] = vec3ToLonLat(hit.point.x, hit.point.y, hit.point.z);
        iso = countryAtLonLat(lon, lat);
      }
    }
    // 3) near-miss on open water → snap to the nearest visible country within a cap.
    if (!iso) iso = nearestCountryWithinCap(cx, cy, all, OCEAN_CAP);

    if (iso) onpick?.(iso);
  }

  // --- Hover pop (locate mode) ---------------------------------------------------
  // The country under the pointer lifts off the globe like a raised tile, so the player
  // sees what they're about to pick. The raised patch is an on-demand triangulated mesh
  // (earcut) for the hovered country *only* — one at a time, so it stays cheap on mobile.
  function onPointerMove(e: PointerEvent): void {
    if (!interactive || disabled || highlightIso) {
      hoverPointer = null;
      if (hoverIso) setHover(null);
      return;
    }
    if (!renderer) return;
    const rect = renderer.domElement.getBoundingClientRect();
    hoverPointer = [e.clientX - rect.left, e.clientY - rect.top];
  }

  function onPointerLeave(): void {
    hoverPointer = null;
    if (hoverIso) setHover(null);
    setMicroHover(null);
  }

  // Resolve what the pointer is over, once per frame (throttling the raycast + geoContains).
  // A micro-state dot within the aim cap wins — it pulses, and the big-country lift yields —
  // mirroring the pick's micro-first precedence; otherwise the country under the pointer
  // lifts.
  function processHover(): void {
    if (!hoverPointer || !renderer || !camera || !earth) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const [cx, cy] = hoverPointer;
    hoverPointer = null;
    const { micro } = collectTargets(rect);
    const microIso = nearestCountryWithinCap(cx, cy, micro, MICRO_CAP);
    if (microIso) {
      setMicroHover(microIso);
      if (hoverIso) setHover(null); // micro dot takes precedence over the tile lift
      return;
    }
    setMicroHover(null);
    ndc.x = (cx / rect.width) * 2 - 1;
    ndc.y = -(cy / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(earth, false)[0];
    const iso = hit
      ? countryAtLonLat(...vec3ToLonLat(hit.point.x, hit.point.y, hit.point.z))
      : null;
    if (iso !== hoverIso) setHover(iso);
  }

  function setHover(iso: string | null): void {
    hoverIso = iso;
    if (iso && liftMesh) {
      const geo = buildLiftGeometry(iso);
      if (!geo) {
        liftTarget = 1;
        return;
      }
      liftMesh.geometry.dispose();
      liftMesh.geometry = geo;
      liftCurrent = prefersReduced() ? LIFT_MAX : LIFT_MIN;
      liftTarget = LIFT_MAX;
    } else {
      liftTarget = 1;
      if (prefersReduced()) {
        liftCurrent = 1;
        if (liftMesh) liftMesh.visible = false;
      }
    }
  }

  // Triangulate the hovered country onto the unit sphere (earcut in lon/lat space). The
  // mesh's uniform scale animates the radial lift, so vertices live at radius 1 here.
  // Antimeridian-crossing rings are split first; each piece is triangulated independently
  // (holes are filled, matching the texture's per-ring fill).
  function buildLiftGeometry(iso: string): THREE.BufferGeometry | null {
    const f = features.get(iso);
    if (!f) return null;
    const positions: number[] = [];
    const indices: number[] = [];
    let base = 0;
    for (const poly of polygonsOf(f.geometry)) {
      for (const ring of poly) {
        for (const piece of splitRingAtAntimeridian(ring)) {
          if (piece.length < 3) continue;
          const flat: number[] = [];
          for (const [lon, lat] of piece) flat.push(lon, lat);
          const tri = earcut(flat);
          if (!tri.length) continue;
          for (const [lon, lat] of piece) positions.push(...lonLatToVec3(lon, lat, 1));
          for (const idx of tri) indices.push(base + idx);
          base += piece.length;
        }
      }
    }
    if (!indices.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  // --- Lifecycle -----------------------------------------------------------------
  function resize(): void {
    if (!renderer || !camera || !container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  let resizeObserver: ResizeObserver | undefined;

  onMount(() => {
    if (!container) return;
    palette = readPalette();

    // Offscreen equirectangular texture canvas.
    const texCanvas = document.createElement('canvas');
    texCanvas.width = TEX_W;
    texCanvas.height = TEX_H;
    texCtx = texCanvas.getContext('2d') ?? undefined;

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      failed = true;
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    // `container` is a dedicated mount node with no Svelte-managed children, so handing its
    // subtree to three.js (its own canvas) doesn't fight the Svelte runtime.
    // eslint-disable-next-line svelte/no-dom-manipulating
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, WORLD_DIST);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8fd0cd, 0.5));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.5);
    keyLight.position.set(-1.1, 1.0, 2.2);
    scene.add(keyLight);

    texture = new THREE.CanvasTexture(texCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    // Clamp both axes so anisotropic/mip sampling can't bleed the bottom texel row over
    // the north pole (or the seam across the top) — the top row is clean ocean.
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    const earthMat = new THREE.MeshPhongMaterial({
      map: texture,
      emissive: 0xffffff,
      emissiveMap: texture,
      emissiveIntensity: 0.7,
      shininess: 14,
      specular: 0x1a5c58,
    });
    earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), earthMat);
    scene.add(earth);

    // Crisp country borders as GPU line geometry, overlaid just above the fill surface.
    // Depth-tested against the earth so the back hemisphere's borders stay hidden. Built
    // once — the geometry never changes (state is conveyed by fills + the hover lift).
    const borderPos: number[] = [];
    for (const f of features.values()) appendBorderSegments(f.geometry, BORDER_R, borderPos);
    const borderGeo = new THREE.BufferGeometry();
    borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderPos, 3));
    borders = new THREE.LineSegments(
      borderGeo,
      new THREE.LineBasicMaterial({
        color: new THREE.Color(palette.border),
        transparent: true,
        opacity: 0.85,
      }),
    );
    scene.add(borders);

    microDotMat = new THREE.PointsMaterial({
      size: DOT_SIZE,
      sizeAttenuation: false,
      map: makeDotTexture(),
      transparent: true,
      depthWrite: false,
      alphaTest: 0.4,
    });
    microDots = new THREE.Points(new THREE.BufferGeometry(), microDotMat);
    microDots.visible = false;
    scene.add(microDots);

    // A single dot drawn over the hovered micro-state; its size pulses in the render loop
    // (a small "grow" affordance, since a micro-state is too tiny to lift like a big country).
    microHoverMat = new THREE.PointsMaterial({
      size: DOT_HOVER_SIZE,
      sizeAttenuation: false,
      map: makeDotTexture(),
      transparent: true,
      depthWrite: false,
      alphaTest: 0.4,
    });
    microHover = new THREE.Points(new THREE.BufferGeometry(), microHoverMat);
    microHover.visible = false;
    microHover.renderOrder = 5; // over the resting dots
    scene.add(microHover);

    // The hovered country's raised tile (geometry swapped in per hover; scale animates the
    // lift). Turquoise + emissive so it pops off the globe as the "about to pick" affordance.
    liftMat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(palette.highlight),
      emissive: new THREE.Color(palette.highlight),
      emissiveIntensity: 0.4,
      shininess: 30,
      side: THREE.DoubleSide,
    });
    liftMesh = new THREE.Mesh(new THREE.BufferGeometry(), liftMat);
    liftMesh.visible = false;
    scene.add(liftMesh);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !prefersReduced();
    controls.dampingFactor = 0.09;
    controls.rotateSpeed = ROTATE_SPEED; // updated per-frame by distance (see the loop)
    controls.enablePan = false;
    controls.minDistance = MIN_DIST;
    controls.maxDistance = MAX_DIST;
    controls.zoomSpeed = 0.9;
    controls.autoRotateSpeed = AUTOROTATE_SPEED;

    for (const [iso2, f] of features) {
      centroids.set(iso2, largestPolygonCentroid(f.geometry));
      if (geoArea(f) < MICRO_STER) microIsos.add(iso2);
      let minLon = 180;
      let minLat = 90;
      let maxLon = -180;
      let maxLat = -90;
      let wide = false;
      for (const poly of polygonsOf(f.geometry)) {
        for (const ring of poly) {
          let rMin = 180;
          let rMax = -180;
          for (const [lon, lat] of ring) {
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lon < rMin) rMin = lon;
            if (lon > rMax) rMax = lon;
          }
          if (rMax - rMin > 180) wide = true;
        }
      }
      bboxes.set(iso2, wide ? [-180, minLat, 180, maxLat] : [minLon, minLat, maxLon, maxLat]);
    }

    drawTexture();
    updateLabels();
    updateMicroDots();
    resize();
    reframe();

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);

    const loop = (now: number): void => {
      raf = requestAnimationFrame(loop);
      if (fly && camera) {
        const p = Math.min(1, (now - fly.t0) / fly.ms);
        const dir = slerpDir(fly.fromDir, fly.toDir, easeInOut(p));
        const dist = fly.fromDist + (fly.dist - fly.fromDist) * easeBack(p);
        camera.position.copy(dir.multiplyScalar(dist));
        camera.lookAt(0, 0, 0);
        if (p >= 1) {
          fly = null;
          if (controls) controls.enabled = true;
        }
      }
      processHover();
      if (liftMesh) {
        // Uniform scale from the globe centre == a pure radial lift for a patch on the
        // unit sphere. Spring toward the target; reduced motion snaps (set in setHover).
        liftCurrent += (liftTarget - liftCurrent) * (prefersReduced() ? 1 : 0.22);
        liftMesh.scale.setScalar(liftCurrent);
        liftMesh.visible = liftCurrent > 1.001;
      }
      if (microHover?.visible && microHoverMat) {
        // A gentle size pulse on the hovered micro-state dot (static under reduced motion).
        microHoverMat.size = prefersReduced()
          ? DOT_HOVER_SIZE
          : DOT_HOVER_SIZE + 3 * Math.sin(now * 0.006);
      }
      if (controls && camera) {
        // Scale drag-spin speed with (distance − globe radius) so surface travel per
        // drag-pixel stays constant — a zoomed-in spin no longer races (see the const).
        const d = camera.position.length();
        controls.rotateSpeed = Math.max(
          ROTATE_SPEED_MIN,
          Math.min(ROTATE_SPEED, (ROTATE_SPEED * (d - 1)) / (WORLD_DIST - 1)),
        );
      }
      if (!fly) controls?.update();
      renderer?.render(scene!, camera!);
    };
    raf = requestAnimationFrame(loop);
  });

  onDestroy(() => {
    if (raf) cancelAnimationFrame(raf);
    resizeObserver?.disconnect();
    if (renderer) {
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
    }
    disposeSprite(revealSprite);
    disposeSprite(pickedSprite);
    controls?.dispose();
    earth?.geometry.dispose();
    borders?.geometry.dispose();
    (borders?.material as THREE.Material | undefined)?.dispose();
    microDots?.geometry.dispose();
    microDotMat?.map?.dispose();
    microDotMat?.dispose();
    microHover?.geometry.dispose();
    microHoverMat?.map?.dispose();
    microHoverMat?.dispose();
    liftMesh?.geometry.dispose();
    liftMat?.dispose();
    texture?.dispose();
    renderer?.dispose();
    if (renderer && container?.contains(renderer.domElement)) {
      // eslint-disable-next-line svelte/no-dom-manipulating
      container.removeChild(renderer.domElement);
    }
  });

  // Recolour the texture, refresh labels + micro dots when the highlight / pick / reveal
  // (or the interactive/answered board state) changes.
  $effect(() => {
    void highlightIso;
    void pickedIso;
    void revealIso;
    void pickedLabel;
    void revealLabel;
    void interactive;
    void disabled;
    if (!renderer) return;
    // Drop any stale hover affordance when the board leaves interactive locate mode (e.g. a
    // new highlight question, or the board locking on answer).
    if (!interactive || disabled || highlightIso) {
      hoverPointer = null;
      if (hoverIso) setHover(null);
      setMicroHover(null);
    }
    drawTexture();
    updateLabels();
    updateMicroDots();
  });

  // Re-frame the camera when the question (or its target) changes.
  $effect(() => {
    void questionKey;
    void highlightIso;
    void revealIso;
    void disabled;
    void focusIsos;
    if (!renderer) return;
    reframe();
  });

  // Gentle idle spin only on a passive world view (the Settings preview) — never during a
  // question and never under reduced motion.
  $effect(() => {
    const idle = !interactive && !highlightIso && !revealIso && !(focusIsos && focusIsos.length);
    if (controls) controls.autoRotate = idle && !prefersReduced();
  });
</script>

<div
  class="globe"
  role="group"
  aria-label={$t('play.map.label')}
  class:interactive={interactive && !disabled}
>
  <!-- Dedicated mount node: Svelte renders nothing inside it, so three.js owns its subtree
       (the WebGL canvas) without confusing the runtime. -->
  <div class="mount" bind:this={container}></div>

  {#if failed}
    <div class="placeholder" role="status">{$t('play.map.error')}</div>
  {:else}
    <div class="globe-controls">
      <button
        type="button"
        onclick={() => zoomBy(1 / ZOOM_STEP)}
        aria-label={$t('play.map.zoomIn')}
      >
        <Icon name="plus" />
      </button>
      <button type="button" onclick={() => zoomBy(ZOOM_STEP)} aria-label={$t('play.map.zoomOut')}>
        <Icon name="minus" />
      </button>
      <button type="button" onclick={resetView} aria-label={$t('play.map.reset')}>
        <Icon name="maximize" />
      </button>
    </div>
  {/if}
</div>

<style>
  .globe {
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 2;
    /* Deep cool-teal "space" so the pale globe reads clearly against the board (the glow
       ring is gone, so the background carries the separation). */
    background: radial-gradient(125% 125% at 33% 24%, #cfe8e7 0%, #6ba7ac 46%, #3f757e 100%);
    border: 2px solid var(--map-border);
    border-radius: var(--radius);
    overflow: hidden;
    touch-action: none;
  }

  .mount {
    position: absolute;
    inset: 0;
  }

  .globe :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
  }

  .globe.interactive :global(canvas) {
    cursor: pointer;
  }

  .placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-muted);
  }

  .globe-controls {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .globe-controls button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-surface) 88%, transparent);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.15);
    transition:
      background 0.12s ease,
      transform 0.12s ease;
  }

  .globe-controls button:hover {
    background: var(--color-surface);
  }

  .globe-controls button:active {
    transform: scale(0.92);
  }

  @media (prefers-reduced-motion: reduce) {
    .globe-controls button {
      transition: none;
    }
  }
</style>
