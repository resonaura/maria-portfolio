import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useTheme } from '../../providers/theme/context';
import './index.scss';

// ─── Low-poly cityscape ───────────────────────────────────────────────────────
// Each building is a rectangle subdivided into 2 triangles (low-poly look).
// Heights follow a Gaussian skyline profile: tall downtown center, shorter edges.
// Five depth layers give natural parallax when the camera moves on scroll; layers
// are grouped into three canvases (front/mid/back) so farther-away buildings can
// carry progressively more CSS blur, like depth of field, without a WebGL
// postprocessing pass (which would also flatten the transparent background).

// Deterministic pseudo-random (no Math.random so layout is stable on re-render)
function seededRand(seed: number): number {
  const s = Math.sin(seed * 9301 + 49297) * 233280;
  return s - Math.floor(s);
}

// Skyline height profile based on 5 distinct districts (suburbs, mid-rise, downtown spires)
// with sudden, sharp architectural height variations rather than a smooth wave.
function skylineHeight(nx: number, jitterSeed: number): number {
  const rand = seededRand(jitterSeed);

  if (nx < -0.65) {
    // West suburbs: low, uniform residential blocks
    return 0.5 + rand * 0.45;
  } else if (nx < -0.22) {
    // Light industrial/mid-rise: alternating blocks
    return 0.9 + rand * 0.95;
  } else if (nx < 0.25) {
    // Downtown financial district: sudden tall skyscrapers and spires
    return 1.8 + rand * 2.1;
  } else if (nx < 0.68) {
    // Midtown/offices: medium high-density blocks
    return 1.2 + rand * 1.2;
  } else {
    // East suburbs: low density blocks
    return 0.4 + rand * 0.5;
  }
}

// ─── Soft star sprite (pixel-sharp cross) ─────────────────────────────────────
function makeStarTexture() {
  const sz = 16;
  const offscreen = document.createElement('canvas');
  offscreen.width = sz;
  offscreen.height = sz;
  const ctx = offscreen.getContext('2d')!;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // Draw a clean '+' cross
  ctx.moveTo(sz / 2, 2);
  ctx.lineTo(sz / 2, sz - 2);
  ctx.moveTo(2, sz / 2);
  ctx.lineTo(sz - 2, sz / 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(offscreen);
  tex.flipY = false;
  return tex;
}

interface LayerConfig {
  z: number;
  cols: number;
  hScale: number;
  gapRatio: number;
  fill: number;
  fOp: number;
  stroke: number;
  sOp: number;
}

interface Tier {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  resize: (w: number, h: number) => void;
  dispose: () => void;
}

// ── Builds one canvas's worth of the scene: a subset of depth layers, and
// optionally the starfield. Kept fully self-contained so each tier can be
// resized/disposed independently of the others.
function buildTier(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  layerConfigs: LayerConfig[],
  includeSky: boolean,
  isDark: boolean,
  maxPixelRatio: number
): Tier {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  // Blurred tiers hide high-frequency detail anyway, so they render at a lower
  // backing resolution — cheaper WebGL draw with no visible quality loss.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
  renderer.setSize(w, h, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
  camera.position.z = 5;

  // World extents at z=0 (camera at z=5, FOV 60)
  const visH = 2 * Math.tan(30 * (Math.PI / 180)) * 5; // ≈ 5.77
  const visW = visH * (w / h);
  const groundY = -visH / 2 - 0.45;

  const allGeo: THREE.BufferGeometry[] = [];
  const allMat: THREE.Material[] = [];

  // ── Adds one building with distinct architectural shape
  function addBuilding(
    bx: number, bw: number,
    groundY: number, bh: number,
    z: number,
    type: number, // 0: Flat, 1: Spire, 2: Stepped, 3: Double Step
    fillColor: number, fillOp: number,
    strokeColor: number, strokeOp: number,
  ) {
    // Reduce gaps: only skip building if type is 4 (low probability now)
    if (type === 4) return;

    const x1 = bx, x2 = bx + bw;
    const y1 = groundY;
    const y2 = groundY + bh;
    const cx = bx + bw / 2;

    const fillVerts: number[] = [];
    const lineVerts: number[] = [];

    if (type === 1) {
      // ── SPIRE BUILDING (Base rect + triangular spire)
      const baseH = bh * 0.7;
      const by2 = groundY + baseH;
      const spireW = bw * 0.45;
      const sx1 = cx - spireW / 2;
      const sx2 = cx + spireW / 2;

      // Base Rect Fill
      fillVerts.push(
        x1, y1, z,  x2, y1, z,  x2, by2, z,
        x1, y1, z,  x2, by2, z,  x1, by2, z
      );
      // Spire Fill
      fillVerts.push(
        sx1, by2, z,  sx2, by2, z,  cx, y2, z
      );

      // Lines
      lineVerts.push(
        x1, y1, z,  x2, y1, z, // bottom
        x2, y1, z,  x2, by2, z, // right base
        x2, by2, z, sx2, by2, z, // right shoulder
        sx2, by2, z, cx, y2, z,  // spire right
        cx, y2, z,   sx1, by2, z, // spire left
        sx1, by2, z, x1, by2, z, // left shoulder
        x1, by2, z,  x1, y1, z,  // left base
        x1, y1, z,   x2, by2, z, // base diagonal
      );
    } else if (type === 2 || type === 3) {
      // ── STEPPED BUILDING (Wide base, narrow top)
      const baseH = bh * 0.65;
      const by2 = groundY + baseH;
      const topW = bw * 0.65;
      const tx1 = cx - topW / 2;
      const tx2 = cx + topW / 2;

      // Base Rect Fill
      fillVerts.push(
        x1, y1, z,  x2, y1, z,  x2, by2, z,
        x1, y1, z,  x2, by2, z,  x1, by2, z
      );
      // Top Rect Fill
      fillVerts.push(
        tx1, by2, z, tx2, by2, z, tx2, y2, z,
        tx1, by2, z, tx2, y2, z, tx1, y2, z
      );

      // Lines
      lineVerts.push(
        x1, y1, z,  x2, y1, z, // bottom
        x2, y1, z,  x2, by2, z, // right base
        x2, by2, z, tx2, by2, z, // right step
        tx2, by2, z, tx2, y2, z, // right top
        tx2, y2, z,  tx1, y2, z, // top
        tx1, y2, z,  tx1, by2, z, // left top
        tx1, by2, z, x1, by2, z, // left step
        x1, by2, z,  x1, y1, z,  // left base
        x1, y1, z,   x2, by2, z, // base diagonal
        tx1, by2, z, tx2, y2, z, // top diagonal
      );
    } else {
      // ── STANDARD FLAT BLOCK
      fillVerts.push(
        x1, y1, z,  x2, y1, z,  x2, y2, z,
        x1, y1, z,  x2, y2, z,  x1, y2, z
      );
      lineVerts.push(
        x1, y1, z,  x2, y1, z,
        x2, y1, z,  x2, y2, z,
        x2, y2, z,  x1, y2, z,
        x1, y2, z,  x1, y1, z,
        x1, y1, z,  x2, y2, z, // diagonal
      );
    }

    const fillGeo = new THREE.BufferGeometry();
    fillGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(fillVerts), 3));
    const fillMat = new THREE.MeshBasicMaterial({
      color: fillColor, transparent: true, opacity: fillOp,
      side: THREE.DoubleSide, depthWrite: true,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    scene.add(new THREE.Mesh(fillGeo, fillMat));

    const outlineGeo = new THREE.BufferGeometry();
    outlineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineVerts), 3));
    const strokeMat = new THREE.LineBasicMaterial({
      color: strokeColor, transparent: true, opacity: strokeOp,
    });
    scene.add(new THREE.LineSegments(outlineGeo, strokeMat));

    allGeo.push(fillGeo, outlineGeo);
    allMat.push(fillMat, strokeMat);
  }

  layerConfigs.forEach(({ z, cols, hScale, gapRatio, fill, fOp, stroke, sOp }) => {
    const spanW = visW * 1.10;
    const slotW = spanW / cols;
    // Add a slight shift to different layers to avoid overlapping columns
    const startX = -visW / 2 - spanW * 0.05 + (seededRand(Math.abs(z) * 5) - 0.5) * (slotW * 0.5);

    for (let i = 0; i < cols; i++) {
      const nx   = (i / (cols - 1)) * 2 - 1;
      const h    = skylineHeight(nx, i + z * 17) * hScale;
      const gap  = slotW * gapRatio;
      const bx   = startX + i * slotW + gap / 2;
      const bw   = slotW - gap;

      const seedVal = i + Math.round(Math.abs(z) * 11);
      const rand = seededRand(seedVal);
      const bType = Math.floor(rand * 4.35);

      addBuilding(bx, bw, groundY, h, z, bType, fill, fOp, stroke, sOp);
    }
  });

  if (includeSky) {
    // ── Faint Constellation Sky (Vector Stars & Lines) ────────────────────
    const starTex = makeStarTexture();
    const starCount = 18;
    const starPositions = new Float32Array(starCount * 3);
    const starList: THREE.Vector3[] = [];

    for (let i = 0; i < starCount; i++) {
      const sx = (seededRand(i * 3) - 0.5) * visW * 1.05;
      // Pushed to the absolute top of the viewport (top 20% area only)
      const sy = (seededRand(i * 3 + 1) * 0.3 + 0.65) * visH * 0.5;
      const sz = -1.5 - seededRand(i * 3 + 2) * 2.5;

      starPositions[i * 3]     = sx;
      starPositions[i * 3 + 1] = sy;
      starPositions[i * 3 + 2] = sz;
      starList.push(new THREE.Vector3(sx, sy, sz));
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x888888,
      size: 0.16,
      map: starTex,
      transparent: true,
      opacity: isDark ? 0.35 : 0.25,
      depthWrite: false,
      blending: isDark ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);
    allGeo.push(starGeo);
    allMat.push(starMat);
    starTex.dispose();

    // Faint connection lines between nearby stars
    const linePairs: number[] = [];
    const maxDist = 1.8;
    for (let i = 0; i < starCount; i++) {
      for (let j = i + 1; j < starCount; j++) {
        const p1 = starList[i];
        const p2 = starList[j];
        if (p1.distanceTo(p2) < maxDist) {
          linePairs.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        }
      }
    }
    if (linePairs.length > 0) {
      const constelGeo = new THREE.BufferGeometry();
      constelGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePairs), 3));
      const constelMat = new THREE.LineBasicMaterial({
        color: isDark ? 0x3c3c3c : 0xb0b0b0,
        transparent: true,
        opacity: isDark ? 0.22 : 0.15,
      });
      scene.add(new THREE.LineSegments(constelGeo, constelMat));
      allGeo.push(constelGeo);
      allMat.push(constelMat);
    }
  }

  return {
    renderer,
    scene,
    camera,
    resize(w: number, h: number) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    },
    dispose() {
      allGeo.forEach((g) => g.dispose());
      allMat.forEach((m) => m.dispose());
      renderer.dispose();
    }
  };
}

export function ThreeBackground() {
  const backRef = useRef<HTMLCanvasElement>(null);
  const midRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const backCanvas = backRef.current;
    const midCanvas = midRef.current;
    const frontCanvas = frontRef.current;
    if (!backCanvas || !midCanvas || !frontCanvas) return;
    let disposed = false;

    const parent = frontCanvas.parentElement!;
    const W = parent.offsetWidth  || window.innerWidth;
    const H = parent.offsetHeight || window.innerHeight;

    const isDark = theme === 'dark';

    // Height scales decreased to keep buildings low-profile
    const allLayers: LayerConfig[] = [
      {
        z: 0.0,  cols: 14, hScale: 0.19, gapRatio: 0.05,
        fill: isDark ? 0x060606 : 0x0d0d0d, fOp: isDark ? 0.94 : 0.14,
        stroke: isDark ? 0x484848 : 0xaaaaaa, sOp: isDark ? 0.75 : 0.60,
      },
      {
        z: -1.0, cols: 17, hScale: 0.18, gapRatio: 0.04,
        fill: isDark ? 0x090909 : 0x0b0b0b, fOp: isDark ? 0.90 : 0.11,
        stroke: isDark ? 0x3d3d3d : 0xa0a0a0, sOp: isDark ? 0.65 : 0.50,
      },
      {
        z: -2.0, cols: 20, hScale: 0.17, gapRatio: 0.03,
        fill: isDark ? 0x0d0d0d : 0x090909, fOp: isDark ? 0.85 : 0.08,
        stroke: isDark ? 0x323232 : 0x959595, sOp: isDark ? 0.55 : 0.40,
      },
      {
        z: -3.0, cols: 23, hScale: 0.16, gapRatio: 0.025,
        fill: isDark ? 0x111111 : 0x070707, fOp: isDark ? 0.80 : 0.06,
        stroke: isDark ? 0x282828 : 0x8a8a8a, sOp: isDark ? 0.45 : 0.30,
      },
      {
        z: -4.0, cols: 26, hScale: 0.15, gapRatio: 0.02,
        fill: isDark ? 0x151515 : 0x050505, fOp: isDark ? 0.75 : 0.04,
        stroke: isDark ? 0x1e1e1e : 0x808080, sOp: isDark ? 0.35 : 0.20,
      },
    ];

    // Three depth tiers, each its own canvas so CSS blur can increase with distance
    // while normal WebGL depth-testing still occludes correctly within a tier.
    // `skip` throttles how often a tier actually repaints during scroll — CSS
    // blur has to be recomputed on every repaint, so the more-blurred (and less
    // detail-sensitive) tiers redraw less often to cut that cost.
    const tierEntries = [
      { tier: buildTier(frontCanvas, W, H, [allLayers[0]], false, isDark, 2), skip: 1 },
      { tier: buildTier(midCanvas, W, H, [allLayers[1], allLayers[2]], false, isDark, 1), skip: 2 },
      { tier: buildTier(backCanvas, W, H, [allLayers[3], allLayers[4]], true, isDark, 1), skip: 3 },
    ];

    const renderAll = () => tierEntries.forEach(({ tier }) => tier.renderer.render(tier.scene, tier.camera));

    // ── Scroll-driven camera parallax ──────────────────────────────────────
    // Ordinary scroll deltas (wheel/trackpad, even a fast flick) track 1:1 with no
    // easing — that's the "no transition" behavior. But a genuinely discontinuous
    // jump (scrollbar-track click, Home/End, a scroll-to-anchor) would otherwise
    // teleport the buildings in a single frame, which reads as a jarring pop — so
    // only *that* case gets eased back in over a few frames.
    const JERK_THRESHOLD_PX = 300; // bigger than any single-frame wheel/trackpad delta
    const SMOOTHING_EASE = 0.25;
    const SNAP_EPSILON_PX = 0.5;

    let lastAppliedScrollY = window.scrollY;
    let scrollScheduled = false;
    let smoothingRaf: number | null = null;
    let frameCounter = 0;
    // Once this section has scrolled out of view there's nothing to gain from still
    // rendering (and re-blurring) three canvases every scroll frame.
    let isVisible = true;

    const applyCamY = (scrollYPx: number) => {
      frameCounter++;
      const camY = (scrollYPx / (window.innerHeight || 1)) * 0.7;
      tierEntries.forEach(({ tier, skip }) => {
        tier.camera.position.y = camY;
        if (frameCounter % skip === 0) tier.renderer.render(tier.scene, tier.camera);
      });
    };

    const smoothStep = () => {
      if (disposed || !isVisible) {
        smoothingRaf = null;
        return;
      }
      const target = window.scrollY;
      const diff = target - lastAppliedScrollY;
      if (Math.abs(diff) <= SNAP_EPSILON_PX) {
        lastAppliedScrollY = target;
        applyCamY(lastAppliedScrollY);
        smoothingRaf = null;
        return;
      }
      lastAppliedScrollY += diff * SMOOTHING_EASE;
      applyCamY(lastAppliedScrollY);
      smoothingRaf = requestAnimationFrame(smoothStep);
    };

    const applyScroll = () => {
      scrollScheduled = false;
      if (smoothingRaf !== null) return; // already easing toward the live scroll position

      const target = window.scrollY;
      const rawDelta = target - lastAppliedScrollY;
      if (Math.abs(rawDelta) <= JERK_THRESHOLD_PX) {
        lastAppliedScrollY = target;
        applyCamY(lastAppliedScrollY);
      } else {
        smoothingRaf = requestAnimationFrame(smoothStep);
      }
    };
    // Skip entirely while off-screen, and resync immediately when it scrolls back
    // into range (see isVisible declaration above).
    const onScroll = () => {
      if (scrollScheduled || disposed || !isVisible) return;
      scrollScheduled = true;
      requestAnimationFrame(applyScroll);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) onScroll();
      },
      { rootMargin: '25% 0px' }
    );
    io.observe(parent);

    renderAll();

    // ── Resize ────────────────────────────────────────────────────────────
    const onResize = () => {
      if (disposed) return;
      const w = parent.offsetWidth;
      const h = parent.offsetHeight;
      tierEntries.forEach(({ tier }) => tier.resize(w, h));
      renderAll();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(parent);

    // ── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      disposed = true;
      if (smoothingRaf !== null) cancelAnimationFrame(smoothingRaf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      tierEntries.forEach(({ tier }) => tier.dispose());
    };
  }, [theme]);

  return (
    <div className='three-bg-stack'>
      <canvas ref={backRef} className='three-bg three-bg--back' />
      <canvas ref={midRef} className='three-bg three-bg--mid' />
      <canvas ref={frontRef} className='three-bg three-bg--front' />
    </div>
  );
}
