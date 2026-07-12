<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import { geoArea, geoCentroid, geoContains } from 'd3-geo';
  import type { FeatureCollection } from 'geojson';
  import type { CountryFeature } from '../../data';
  import { t } from '../../i18n';
  import Icon from './Icon.svelte';
  import { nearestCountryWithinCap, type CentroidTarget } from './map-hit';
  import {
    TEX_W,
    TEX_H,
    crossesAntimeridian,
    fitDistanceForAngularRadius,
    lonLatToTexPx,
    lonLatToVec3,
    polygonsOf,
    regionAngularRadius,
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

  interface Palette {
    water: string;
    land: string;
    border: string;
    highlight: string;
    highlightLine: string;
    correct: string;
    wrong: string;
    accent: string;
    coral: string;
  }

  let container = $state<HTMLDivElement>();
  let failed = $state(false);

  // three.js objects (created on mount; not reactive state).
  let renderer: THREE.WebGLRenderer | undefined;
  let scene: THREE.Scene | undefined;
  let camera: THREE.PerspectiveCamera | undefined;
  let controls: OrbitControls | undefined;
  let earth: THREE.Mesh | undefined;
  let pin: THREE.Sprite | undefined;
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
      highlightLine: v('--map-highlight-line') || '#0b7e7a',
      correct: v('--color-correct') || '#1e9e5a',
      wrong: v('--color-wrong') || '#cf3b2c',
      accent: v('--color-accent') || '#10a5a0',
      coral: v('--color-coral') || '#ff7a59',
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
  function tracePolygons(geom: CountryFeature['geometry'], shift: number): void {
    if (!texCtx) return;
    for (const poly of polygonsOf(geom)) {
      for (const ring of poly) {
        texCtx.beginPath();
        ring.forEach(([lon, lat], i) => {
          const [x, y] = lonLatToTexPx(lon + shift, lat);
          if (i) texCtx!.lineTo(x, y);
          else texCtx!.moveTo(x, y);
        });
        texCtx.closePath();
        texCtx.fill('evenodd');
        texCtx.stroke();
      }
    }
  }

  function drawTexture(): void {
    if (!texCtx || !texture) return;
    texCtx.clearRect(0, 0, TEX_W, TEX_H);
    texCtx.fillStyle = palette.water;
    texCtx.fillRect(0, 0, TEX_W, TEX_H);
    texCtx.lineJoin = 'round';
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
      texCtx.strokeStyle = isHighlight
        ? palette.highlightLine
        : isReveal
          ? palette.correct
          : isPicked
            ? palette.wrong
            : palette.border;
      texCtx.lineWidth = isHighlight || isReveal || isPicked ? 2.2 : 1;
      const shifts = crossesAntimeridian(f.geometry) ? [0, -360, 360] : [0];
      for (const s of shifts) tracePolygons(f.geometry, s);
    }
    texture.needsUpdate = true;
  }

  // --- Drop-pin ------------------------------------------------------------------
  function makePin(): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.translate(64, 74);
    g.scale(3, 3);
    g.beginPath();
    g.moveTo(0, 6);
    g.bezierCurveTo(-11, -8, -7, -22, 0, -22);
    g.bezierCurveTo(7, -22, 11, -8, 0, 6);
    g.fillStyle = palette.coral;
    g.fill();
    g.beginPath();
    g.arc(0, -15, 4, 0, 2 * Math.PI);
    g.fillStyle = '#fff';
    g.fill();
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }),
    );
    sprite.scale.set(0.16, 0.16, 1);
    sprite.visible = false;
    return sprite;
  }

  // The country a question wants to teach: the highlight prompt, or (once answered) the
  // locate reveal target. Fresh locate questions have neither → no pin.
  function teachTarget(): string | null {
    return highlightIso ?? (disabled ? revealIso : null);
  }

  function placePin(): void {
    if (!pin) return;
    const iso = teachTarget();
    if (iso && centroids.has(iso)) {
      const [lon, lat] = centroids.get(iso)!;
      pin.position.copy(new THREE.Vector3(...lonLatToVec3(lon, lat, 1.02)));
      pin.userData.base = pin.position.clone();
      pin.visible = true;
    } else {
      pin.visible = false;
    }
  }

  // --- Reveal / picked name labels (billboarded sprites) -------------------------
  function makeTextSprite(text: string, color: string, place: 'above' | 'below'): THREE.Sprite {
    const font = 46;
    const pad = 18;
    const measure = document.createElement('canvas').getContext('2d')!;
    measure.font = `600 ${font}px system-ui, sans-serif`;
    const w = Math.ceil(measure.measureText(text).width) + pad * 2;
    const h = font + pad * 2;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(255,255,255,0.94)';
    roundRect(g, 1, 1, w - 2, h - 2, h / 2);
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = color;
    g.stroke();
    g.font = `600 ${font}px system-ui, sans-serif`;
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    const scale = 0.13; // world-units tall (tuned for the ~COUNTRY_DIST answer framing)
    sprite.scale.set((w / h) * scale, scale, 1);
    // Anchor so the label floats just above (or below) the surface point.
    sprite.center.set(0.5, place === 'above' ? -0.1 : 1.1);
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
    if (revealLabel && revealIso && centroids.has(revealIso)) {
      revealSprite = makeTextSprite(revealLabel, palette.correct, 'above');
      const [lon, lat] = centroids.get(revealIso)!;
      revealSprite.position.copy(new THREE.Vector3(...lonLatToVec3(lon, lat, 1.05)));
      scene.add(revealSprite);
    }
    if (pickedLabel && pickedIso && pickedIso !== revealIso && centroids.has(pickedIso)) {
      pickedSprite = makeTextSprite(pickedLabel, palette.wrong, 'below');
      const [lon, lat] = centroids.get(pickedIso)!;
      pickedSprite.position.copy(new THREE.Vector3(...lonLatToVec3(lon, lat, 1.05)));
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

  function regionCentroid(isos: string[]): [number, number] | null {
    const feats: CountryFeature[] = [];
    for (const iso of isos) {
      const f = features.get(iso);
      if (f) feats.push(f);
    }
    if (!feats.length) return null;
    const c = geoCentroid({ type: 'FeatureCollection', features: feats } as FeatureCollection);
    return Number.isFinite(c[0]) && Number.isFinite(c[1]) ? [c[0], c[1]] : null;
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
      const c = regionCentroid(focusIsos);
      if (c) {
        const members = focusIsos
          .map((iso) => centroids.get(iso))
          .filter((m): m is [number, number] => !!m);
        const dist = fitDistanceForAngularRadius(regionAngularRadius(c, members));
        flyToLonLat(c[0], c[1], dist);
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
        for (const [iso2, f] of features) {
          if (geoContains(f, [lon, lat])) {
            iso = iso2;
            break;
          }
        }
      }
    }
    // 3) near-miss on open water → snap to the nearest visible country within a cap.
    if (!iso) iso = nearestCountryWithinCap(cx, cy, all, OCEAN_CAP);

    if (iso) onpick?.(iso);
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

    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.16, 64, 48),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { c: { value: new THREE.Color(palette.accent) } },
        vertexShader: `varying vec3 vN; varying vec3 vP;
          void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vP = mv.xyz; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform vec3 c; varying vec3 vN; varying vec3 vP;
          void main(){ float i = pow(1.0 - abs(dot(vN, normalize(-vP))), 3.0); gl_FragColor = vec4(c, i * 0.9); }`,
      }),
    );
    scene.add(atmo);

    pin = makePin();
    scene.add(pin);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !prefersReduced();
    controls.dampingFactor = 0.09;
    controls.rotateSpeed = 0.62;
    controls.enablePan = false;
    controls.minDistance = MIN_DIST;
    controls.maxDistance = MAX_DIST;
    controls.zoomSpeed = 0.9;
    controls.autoRotateSpeed = AUTOROTATE_SPEED;

    for (const [iso2, f] of features) {
      centroids.set(iso2, geoCentroid(f) as [number, number]);
      if (geoArea(f) < MICRO_STER) microIsos.add(iso2);
    }

    drawTexture();
    updateLabels();
    placePin();
    resize();
    reframe();

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
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
      if (pin?.visible && pin.userData.base) {
        const base = pin.userData.base as THREE.Vector3;
        pin.position.copy(base).multiplyScalar(1 + 0.01 * (1 + Math.sin(now * 0.004)));
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
    }
    disposeSprite(revealSprite);
    disposeSprite(pickedSprite);
    controls?.dispose();
    earth?.geometry.dispose();
    texture?.dispose();
    renderer?.dispose();
    if (renderer && container?.contains(renderer.domElement)) {
      // eslint-disable-next-line svelte/no-dom-manipulating
      container.removeChild(renderer.domElement);
    }
  });

  // Recolour the texture, refresh labels + pin when the highlight / pick / reveal changes.
  $effect(() => {
    void highlightIso;
    void pickedIso;
    void revealIso;
    void pickedLabel;
    void revealLabel;
    if (!renderer) return;
    drawTexture();
    updateLabels();
    placePin();
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
    background: radial-gradient(120% 120% at 34% 26%, #f3fdfc 0%, #dcf4f2 42%, #bfe6e4 100%);
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
