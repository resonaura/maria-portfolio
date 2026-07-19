import { useCallback, useEffect, useRef, useState } from 'react';

export interface SvgRectPosition {
  /** left offset inside the container, px */
  left: number;
  /** top offset inside the container, px */
  top: number;
  /** width in screen px */
  width: number;
  /** height in screen px */
  height: number;
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
 * Locates a marked placeholder rectangle inside an inline artwork SVG (an
 * element with `id={targetId}`) and reports where it lands on screen, so real
 * HTML content (a heading, a button) can be positioned directly on top of it —
 * same technique as useSvgCirclePosition, generalized to a rectangle instead
 * of assuming a circle.
 *
 * Returns a callback ref (not a RefObject) deliberately: ProgressiveImage's type
 * dispatcher (raster vs vector vs inline-svg) mounts a genuinely different
 * component once the manifest loads, which unmounts/remounts the underlying DOM
 * node. A plain useRef's `.current` mutation wouldn't re-trigger this hook's
 * effect, so it would keep watching a detached element forever — a callback ref
 * (backed by state) re-fires on every attach, including that remount.
 */
export function useSvgRectPosition(
  targetId: string
): [SvgRectPosition, (node: HTMLElement | null) => void] {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [pos, setPos] = useState<SvgRectPosition>({ left: 0, top: 0, width: 0, height: 0, ready: false });
  const lastPosRef = useRef(pos);

  const ref = useCallback((node: HTMLElement | null) => setContainer(node), []);

  useEffect(() => {
    if (!container) return;

    const compute = () => {
      const svg = container.querySelector('svg');
      const target = svg?.querySelector(`#${targetId}`) as SVGGraphicsElement | null;
      if (!svg || !target) return;

      const viewBox = parseViewBox(svg);
      if (!viewBox) return;

      let bbox: DOMRect;
      try {
        bbox = target.getBBox();
      } catch {
        return; // element not laid out yet
      }
      if (!bbox.width || !bbox.height) return;

      const containerRect = container.getBoundingClientRect();
      if (!containerRect.width || !containerRect.height) return;

      // Transform target coordinates using the coordinate transform matrix (CTM)
      // to resolve parent transforms like scale matrices or translation offsets.
      const ctm = target.getCTM();

      if (ctm) {
        const corners = [
          { x: bbox.x, y: bbox.y },
          { x: bbox.x + bbox.width, y: bbox.y },
          { x: bbox.x, y: bbox.y + bbox.height },
          { x: bbox.x + bbox.width, y: bbox.y + bbox.height }
        ].map((p) => ({
          x: ctm.a * p.x + ctm.c * p.y + ctm.e,
          y: ctm.b * p.x + ctm.d * p.y + ctm.f
        }));

        const xs = corners.map((c) => c.x);
        const ys = corners.map((c) => c.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        // Since ctm transforms directly to the SVG viewport's coordinate system
        // (which is in CSS pixels of the SVG element), these values are already
        // scaled and offset correctly. No manual scale/offset multiplication is needed.
        const next: SvgRectPosition = {
          left: minX,
          top: minY,
          width: maxX - minX,
          height: maxY - minY,
          ready: true
        };

        const prev = lastPosRef.current;
        const unchanged =
          Math.abs(next.left - prev.left) < EPSILON &&
          Math.abs(next.top - prev.top) < EPSILON &&
          Math.abs(next.width - prev.width) < EPSILON &&
          Math.abs(next.height - prev.height) < EPSILON &&
          next.ready === prev.ready;
        if (unchanged) return;

        lastPosRef.current = next;
        setPos(next);
        return;
      }

      // Fallback in case target.getCTM() is not available
      const scale = Math.max(containerRect.width / viewBox.w, containerRect.height / viewBox.h);
      const offsetX = (containerRect.width - viewBox.w * scale) / 2;
      const offsetY = (containerRect.height - viewBox.h * scale) / 2;

      const next: SvgRectPosition = {
        left: offsetX + bbox.x * scale,
        top: offsetY + bbox.y * scale,
        width: bbox.width * scale,
        height: bbox.height * scale,
        ready: true
      };

      const prev = lastPosRef.current;
      const unchanged =
        Math.abs(next.left - prev.left) < EPSILON &&
        Math.abs(next.top - prev.top) < EPSILON &&
        Math.abs(next.width - prev.width) < EPSILON &&
        Math.abs(next.height - prev.height) < EPSILON &&
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
  }, [container, targetId]);

  return [pos, ref];
}
