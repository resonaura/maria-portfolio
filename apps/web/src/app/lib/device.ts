// Non-standard, Chrome/Edge-only API (Device Memory spec draft) — not in
// lib.dom.d.ts, so it's typed locally rather than casting to `any`.
interface INavigatorWithDeviceMemory extends Navigator {
  deviceMemory?: number;
}

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mobile|android|iphone|ipad|tablet|ipod/.test(
    navigator.userAgent.toLowerCase()
  );
}

/**
 * Best-effort heuristic for "can this device comfortably keep a live
 * backdrop-filter blur compositing without janking." Deliberately
 * conservative — only flags genuinely low-end hardware (thresholds well
 * below typical modern laptops/phones) so it doesn't false-positive on
 * ordinary devices.
 *
 * Note: `prefers-reduced-motion` is intentionally NOT part of this — that's
 * an accessibility preference about *animation*, not a proxy for weak
 * hardware, and folding it in here previously disabled effects for anyone
 * with that OS setting on, regardless of their actual specs.
 */
export function isLowPerformanceDevice(): boolean {
  if (typeof navigator === 'undefined') return false;

  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = (navigator as INavigatorWithDeviceMemory).deviceMemory ?? 8;

  return cores <= 2 || memory <= 2;
}
