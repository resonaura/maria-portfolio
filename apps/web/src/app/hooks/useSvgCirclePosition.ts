import { useCallback, useEffect, useRef, useState } from 'react';

export interface SvgCirclePosition {
  /** left offset inside the container, px */
  left: number;
  /** top offset inside the container, px */
  top: number;
  /** circle radius in screen px */
  radius: number;
  ready: boolean;
}

const EPSILON = 0.5; // px — ignore sub-pixel ResizeObserver jitter

function parseViewBox(svg: SVGSVGElement): { w: number; h: number } | null {
  const attr = svg.getAttribute('viewBox');
  if (!attr) return null;
  const parts = attr.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || !parts[2] || !parts[3]) return null;
  return { w: parts[2], h: parts[3] };
}

/**
 * Locates the dark-blue decorative circle in the artwork SVG (the element with
 * `id="ring-target"`) and reports where it lands on screen, so the rotating
 * quote ring can be positioned directly on top of it. Falls back to the first
 * `clipPath > *` child for any artwork that pre-dates the id convention.
 *
 * Returns a callback ref (not a RefObject) deliberately: ProgressiveImage's type
 * dispatcher (raster vs vector vs inline-svg) mounts a genuinely different
 * component once the manifest loads, which unmounts/remounts the underlying DOM
 * node. A plain useRef's `.current` mutation wouldn't re-trigger this hook's
 * effect, so it would keep watching a detached element forever — a callback ref
 * (backed by state) re-fires on every attach, including that remount.
 */
export function useSvgCirclePosition(): [SvgCirclePosition, (node: HTMLElement | null) => void] {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [pos, setPos] = useState<SvgCirclePosition>({ left: 0, top: 0, radius: 0, ready: false });
  const lastPosRef = useRef(pos);

  const ref = useCallback((node: HTMLElement | null) => setContainer(node), []);

  useEffect(() => {
    if (!container) return;

    const compute = () => {
      const svg = container.querySelector('svg');
      // Target the specific dark-blue decorative circle marked in the artwork SVG.
      // Falls back to the first clipPath child for backwards-compat with other artwork.
      const ringTarget =
        (svg?.querySelector('#ring-target') as SVGGraphicsElement | null) ??
        (svg?.querySelector('clipPath > *') as SVGGraphicsElement | null);
      if (!svg || !ringTarget) return;

      const viewBox = parseViewBox(svg);
      if (!viewBox) return;

      let bbox: DOMRect;
      try {
        bbox = ringTarget.getBBox();
      } catch {
        return; // element not laid out yet
      }
      if (!bbox.width) return;

      // The target is a perfect circle: radius = half bbox width,
      // centre = (bbox.x + r, bbox.y + r).
      const r = bbox.width / 2;
      const cx = bbox.x + r;
      const cy = bbox.y + r;

      const containerRect = container.getBoundingClientRect();
      if (!containerRect.width || !containerRect.height) return;

      // useProgressiveSvg sets preserveAspectRatio="xMidYMid slice" on the <svg>
      // element at mount — uniform scale to cover the container (like object-fit:cover).
      // Math.max mirrors that: scale by whichever axis fills the container first.
      const scale = Math.max(containerRect.width / viewBox.w, containerRect.height / viewBox.h);
      const offsetX = (containerRect.width - viewBox.w * scale) / 2;
      const offsetY = (containerRect.height - viewBox.h * scale) / 2;

      const next: SvgCirclePosition = {
        left: offsetX + cx * scale,
        top: offsetY + cy * scale,
        radius: r * scale,
        ready: true
      };

      const prev = lastPosRef.current;
      const unchanged =
        Math.abs(next.left - prev.left) < EPSILON &&
        Math.abs(next.top - prev.top) < EPSILON &&
        Math.abs(next.radius - prev.radius) < EPSILON &&
        next.ready === prev.ready;
      if (unchanged) return;

      lastPosRef.current = next;
      setPos(next);
    };

    const ro = new ResizeObserver(compute);
    ro.observe(container);

    // The inline SVG is injected asynchronously (see useProgressiveSvg) — a plain
    // effect-time compute() can run before it exists, so also watch for it landing.
    const mo = new MutationObserver(compute);
    mo.observe(container, { childList: true, subtree: true });

    compute();

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [container]);

  return [pos, ref];
}
