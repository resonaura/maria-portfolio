import { useImgManifest, type ImageManifest } from '@maria-portfolio/img-client';
import { useEffect, useRef, useState } from 'react';

/**
 * Reads whatever's actually rendered directly under the header and decides
 * whether it's light or dark — not the user's light/dark theme choice, since a
 * section can (and does, e.g. a fixed-color band) diverge from the current
 * theme's usual background.
 *
 * Two signals, tried in order at the sample point:
 *  1. An <img> covering that point — the API precomputes a per-row brightness
 *     profile for every image at index time (see OptimizerService.
 *     computeBrightnessProfile), so a single illustration spanning both light
 *     and dark regions reads correctly depending on which part is currently on
 *     screen, without touching live pixel data on the client at all.
 *  2. Otherwise, the resolved `background-color` of the element stack — works
 *     for plain divs/sections regardless of whether the color came from a
 *     theme variable or a hardcoded one-off.
 *
 * Sampling is anchored on where the header's actual content sits — the logo on
 * the left, the mail/theme-toggle actions on the right — not the horizontal
 * center of the viewport, which usually shows neither. The left side (the
 * logo) is weighted more heavily: it's the one piece that's always there and
 * always needs to read clearly, while the right cluster shifts around a bit
 * across breakpoints.
 *
 * Two noise-reduction passes on top, since a raw single-point/single-band read
 * flickers right at content boundaries (a thin dark line inside an otherwise
 * light band, a small badge/border sitting exactly on the sample row, scrolling
 * exactly across a section seam, etc.) — and this applies just as much to plain
 * divs as to images, so both signals get the same treatment:
 *  - Spatially: averages a small 2D neighborhood (a grid of x/y points, plus
 *    several profile bands for the image case) instead of one exact point.
 *  - Temporally: hysteresis around the light/dark threshold — once decided,
 *    the signal has to cross a wider margin the other way before it flips
 *    back, instead of chattering every frame right at the boundary.
 */

// Perceived-brightness weighting (ITU-R BT.601) — good enough for a binary
// light/dark contrast decision, no need for full WCAG relative luminance.
const LIGHT_THRESHOLD = 0.6;
const HYSTERESIS_MARGIN = 0.08;
const PROFILE_BAND_RADIUS = 1; // average a 3-band window — wide enough to smooth noise
// without averaging a real dark patch away into a falsely-bright reading
const X_SAMPLE_SPREAD = 40; // px either side of an anchor, sampled alongside it
const Y_SAMPLE_SPREAD = 12; // px above/below the sample row, sampled alongside it
const LEFT_ANCHOR_WEIGHT = 0.65; // the logo matters more than the right-side actions
const FALLBACK_LEFT_X = 50; // used only if .logo isn't in the DOM yet
const FALLBACK_RIGHT_INSET = 75; // ...ditto for .actions, measured from the right edge

// Images read "light" too easily at the plain 0.6 threshold — a mid-gray patch
// of illustration isn't white enough to justify dark header text/icons. Only a
// genuinely near-white region should count; anything dimmer gets pulled well
// under LIGHT_THRESHOLD so it reads solidly dark on the shared brightness scale
// also used for plain div backgrounds (which don't get this treatment — a
// legitimately light-but-not-white UI background, e.g. #eaeaea, is fine as-is).
const IMAGE_WHITE_FLOOR = 0.85;
function toImageBrightness(rawValue: number): number {
  return rawValue >= IMAGE_WHITE_FLOOR ? rawValue : Math.min(rawValue, 0.5);
}

function objectPositionFraction(img: HTMLImageElement): { x: number; y: number } {
  const [xStr, yStr] = getComputedStyle(img).objectPosition.split(' ');
  const x = parseFloat(xStr);
  const y = parseFloat(yStr);
  return {
    x: Number.isNaN(x) ? 0.5 : x / 100,
    y: Number.isNaN(y) ? 0.5 : y / 100
  };
}

/** Manifest keys are plain storage paths (e.g. "arts/4-1.png"); the DOM <img>
 * points at "/img/arts/4-1.png?w=...&v=...". Strip the prefix/query back off. */
function manifestKeyForImg(img: HTMLImageElement): string | null {
  const src = img.currentSrc || img.src;
  if (!src) return null;
  try {
    const { pathname } = new URL(src, window.location.origin);
    const match = /^\/img\/(.+)$/.exec(pathname);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/** Maps the viewport point to a row in a precomputed brightness profile,
 * replicating object-fit: cover's crop math against the given box, then
 * averages a small band window around it instead of reading one band alone. */
function profileValueForBox(
  profile: number[],
  intrinsic: { w: number; h: number },
  rect: DOMRect,
  pos: { x: number; y: number },
  clientY: number
): number | null {
  if (rect.height === 0) return null;
  const fy = (clientY - rect.top) / rect.height;
  if (fy < 0 || fy > 1) return null;

  const boxRatio = rect.width / rect.height;
  const imgRatio = intrinsic.w / intrinsic.h;

  let sourceYFraction: number;
  if (imgRatio > boxRatio) {
    // image relatively wider than its box — full height visible, no vertical crop
    sourceYFraction = fy;
  } else {
    const visibleFraction = boxRatio / imgRatio; // < 1: how much of the height survives the crop
    sourceYFraction = (1 - visibleFraction) * pos.y + fy * visibleFraction;
  }

  const centerBand = sourceYFraction * profile.length;
  let sum = 0;
  let count = 0;
  for (let offset = -PROFILE_BAND_RADIUS; offset <= PROFILE_BAND_RADIUS; offset++) {
    const band = Math.round(centerBand) + offset;
    if (band < 0 || band >= profile.length) continue;
    sum += profile[band];
    count++;
  }
  const rawValue =
    count > 0 ? sum / count : profile[Math.min(profile.length - 1, Math.max(0, Math.floor(centerBand)))];
  return toImageBrightness(rawValue);
}

/** The <img>-based paths (raster + vector-via-<img>) respect object-position. */
function profileValueForImg(img: HTMLImageElement, manifest: ImageManifest, clientY: number): number | null {
  const key = manifestKeyForImg(img);
  if (!key) return null;
  const profile = manifest[key]?.contrastProfile;
  const intrinsic = manifest[key]?.intrinsic;
  if (!profile?.length || !intrinsic?.w || !intrinsic?.h) return null;
  return profileValueForBox(profile, { w: intrinsic.w, h: intrinsic.h }, img.getBoundingClientRect(), objectPositionFraction(img), clientY);
}

/** SVGs with embedded raster art (svg-with-raster) render as a raw injected
 * <svg>, not an <img> — no src/currentSrc to recover the manifest key from, so
 * ProgressiveImage tags the outer container with data-progressive-src instead.
 * useProgressiveSvg always sets preserveAspectRatio="xMidYMid slice" on the
 * injected root — SVG's own equivalent of object-fit: cover + center, fixed
 * (no per-instance object-position to account for). */
function profileValueForInlineSvg(container: Element, manifest: ImageManifest, clientY: number): number | null {
  const key = container.getAttribute('data-progressive-src');
  if (!key) return null;
  const profile = manifest[key]?.contrastProfile;
  const intrinsic = manifest[key]?.intrinsic;
  if (!profile?.length || !intrinsic?.w || !intrinsic?.h) return null;
  return profileValueForBox(profile, { w: intrinsic.w, h: intrinsic.h }, container.getBoundingClientRect(), { x: 0.5, y: 0.5 }, clientY);
}

function parseRgba(color: string): { r: number; g: number; b: number; a: number } | null {
  const match = /rgba?\(([^)]+)\)/.exec(color);
  if (!match) return null;
  const parts = match[1].split(',').map((part) => parseFloat(part.trim()));
  const [r, g, b, a = 1] = parts;
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b, a };
}

function parseHex(color: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(color.trim());
  if (!match) return null;
  const hex = match[1];
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
}

function luminanceOf(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Returns a brightness value in [0, 1], or null if this element's own
 * background-color isn't a usable signal (transparent). */
function backgroundBrightness(color: string): number | null {
  const rgba = parseRgba(color);
  if (!rgba || rgba.a < 0.5) return null;
  return luminanceOf(rgba.r, rgba.g, rgba.b);
}

// html is the only element with an animated `background-color` (theme.scss's
// 0.3s transition) — everything else that falls back to it (e.g. the intro
// slide, where the canvas/wrapper set no background of their own) would read
// a value still mid-transition right after a theme toggle, not the settled
// one, since a sample only runs once per detected change rather than for the
// whole transition. --app-background itself is a plain custom property with
// no transition possible on it, so reading it directly sidesteps that
// entirely and gets the correct answer instantly regardless of the CSS
// animation's progress.
function rootBackgroundBrightness(): number | null {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--app-background').trim();
  const rgb = parseHex(raw);
  return rgb ? luminanceOf(rgb.r, rgb.g, rgb.b) : null;
}

/** Brightness at one exact point — the per-point half of the spatial average
 * taken across a few x positions by sampleBrightness. */
function pointBrightness(x: number, y: number, manifest: ImageManifest): number | null {
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    if (el.closest('header')) continue; // skip the header's own chrome/overlays

    if (el instanceof HTMLImageElement) {
      const value = profileValueForImg(el, manifest, y);
      if (value !== null) return value;
    }

    const progressiveContainer = el.closest('[data-progressive-src]');
    if (progressiveContainer) {
      const value = profileValueForInlineSvg(progressiveContainer, manifest, y);
      if (value !== null) return value;
    }

    if (el === document.documentElement || el === document.body) {
      const rootValue = rootBackgroundBrightness();
      if (rootValue !== null) return rootValue;
    }

    const brightness = backgroundBrightness(getComputedStyle(el).backgroundColor);
    if (brightness !== null) return brightness;
  }
  return null;
}

/** Averages brightness across a small grid of points around one anchor —
 * smooths out a thin seam (a divider, a border, a small badge, a line inside
 * an illustration) that would otherwise flip the decision for one frame as it
 * crosses the exact sample point. Applies equally to the image-profile and
 * background-color signals, since pointBrightness tries both per point. */
function sampleBrightnessAt(centerX: number, centerY: number, manifest: ImageManifest): number | null {
  const xs = [centerX - X_SAMPLE_SPREAD, centerX, centerX + X_SAMPLE_SPREAD].filter(
    (x) => x >= 0 && x <= window.innerWidth
  );
  const ys = [centerY - Y_SAMPLE_SPREAD, centerY, centerY + Y_SAMPLE_SPREAD].filter((y) => y >= 0);

  const values: number[] = [];
  for (const x of xs) {
    for (const y of ys) {
      const value = pointBrightness(x, y, manifest);
      if (value !== null) values.push(value);
    }
  }
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Finds the actual on-screen center of the header's logo and actions cluster
 * — falls back to fixed offsets matching the header's own CSS padding if
 * either isn't mounted yet (e.g. the very first sample). */
function headerAnchors(): { left: number; right: number } {
  const logoRect = document.querySelector('header .logo')?.getBoundingClientRect();
  const actionsRect = document.querySelector('header .actions')?.getBoundingClientRect();
  return {
    left: logoRect ? logoRect.left + logoRect.width / 2 : FALLBACK_LEFT_X,
    right: actionsRect ? actionsRect.left + actionsRect.width / 2 : window.innerWidth - FALLBACK_RIGHT_INSET
  };
}

/** Combines both anchors, weighted toward the left (the logo) — falls back to
 * whichever anchor actually produced a usable reading if one comes back empty. */
function sampleBrightness(y: number, manifest: ImageManifest): number {
  const { left, right } = headerAnchors();
  const leftValue = sampleBrightnessAt(left, y, manifest);
  const rightValue = sampleBrightnessAt(right, y, manifest);

  if (leftValue === null && rightValue === null) return 0.2; // nothing usable — default to dark
  if (leftValue === null) return rightValue!;
  if (rightValue === null) return leftValue;
  return leftValue * LEFT_ANCHOR_WEIGHT + rightValue * (1 - LEFT_ANCHOR_WEIGHT);
}

export function useHeaderContrast(sampleAtY: number): 'light' | 'dark' {
  const { manifest } = useImgManifest();
  const [background, setBackground] = useState<'light' | 'dark'>('dark');
  const wasLightRef = useRef(false);

  useEffect(() => {
    let scheduled = false;

    const sample = () => {
      scheduled = false;
      const brightness = sampleBrightness(sampleAtY, manifest);

      // Hysteresis: once light, stay light until brightness drops well below the
      // threshold (and vice versa) — a value hovering right at LIGHT_THRESHOLD
      // would otherwise flip the decision every frame.
      const isLight = wasLightRef.current
        ? brightness > LIGHT_THRESHOLD - HYSTERESIS_MARGIN
        : brightness > LIGHT_THRESHOLD + HYSTERESIS_MARGIN;

      if (isLight !== wasLightRef.current) {
        wasLightRef.current = isLight;
        setBackground(isLight ? 'light' : 'dark');
      }
    };

    const onChange = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(sample);
    };

    window.addEventListener('scroll', onChange, { passive: true });
    window.addEventListener('resize', onChange);

    // Toggling the theme changes any section relying on var(--app-background)
    // without any scroll/resize event firing — nothing else would trigger a
    // recompute. A MutationObserver on the theme attribute *should* catch this
    // reliably, but a plain interval poll of that same attribute's value is
    // added alongside it as a fallback that cannot miss it, whatever timing
    // quirk (React effect ordering, StrictMode's double-invoked effects, etc.)
    // might otherwise cause the observer to be attached a beat too late.
    const themeObserver = new MutationObserver(onChange);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    let lastTheme = document.documentElement.getAttribute('data-theme');
    const pollTheme = window.setInterval(() => {
      const current = document.documentElement.getAttribute('data-theme');
      if (current !== lastTheme) {
        lastTheme = current;
        onChange();
      }
    }, 200);

    sample();

    return () => {
      window.removeEventListener('scroll', onChange);
      window.removeEventListener('resize', onChange);
      themeObserver.disconnect();
      window.clearInterval(pollTheme);
    };
  }, [sampleAtY, manifest]);

  return background;
}
