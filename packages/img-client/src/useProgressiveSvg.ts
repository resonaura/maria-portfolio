import { useCallback, useEffect, useRef, useState } from 'react';
import { pickBreakpoint } from './breakpoint.js';
import { useImgManifest } from './context.js';
import { useDevicePixelRatio } from './useDevicePixelRatio.js';
import { useElementWidth } from './useElementWidth.js';

const XLINK_NS = 'http://www.w3.org/1999/xlink';

function decodeInlineSvg(dataUri: string): string | null {
  const comma = dataUri.indexOf(',');
  if (comma === -1) return null;
  try {
    const binary = atob(dataUri.slice(comma + 1));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return null;
  }
}

function parseSvg(svgText: string): SVGSVGElement | null {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return null;
  return doc.documentElement as unknown as SVGSVGElement;
}

/**
 * Patches only the <image> href attributes of an already-mounted inline SVG in
 * place, rather than replacing the document. Every cached variant of a
 * svg-with-raster file (LQIP included) is generated from the same shell by the
 * backend's SvgService, so <image> tags always appear in the same document
 * order across breakpoints — matching by index is safe.
 */
function patchImageHrefs(container: Element, nextSvgText: string): boolean {
  const nextRoot = parseSvg(nextSvgText);
  if (!nextRoot) return false;

  const current = container.querySelectorAll('image');
  const next = nextRoot.querySelectorAll('image');
  if (current.length === 0 || current.length !== next.length) return false;

  current.forEach((el, i) => {
    const href = next[i].getAttribute('href') ?? next[i].getAttributeNS(XLINK_NS, 'href');
    if (!href) return;
    el.setAttribute('href', href);
    el.setAttributeNS(XLINK_NS, 'href', href);
  });
  return true;
}

interface UseProgressiveSvgOptions {
  debounceMs?: number;
}

/**
 * Progressive loading for SVGs with embedded raster art. Instead of an <img> whose
 * `src` swap forces a full document refetch + repaint on every breakpoint change,
 * the SVG is injected inline once (from the LQIP, so it's on screen instantly with
 * no network wait) and every later breakpoint upgrade fetches the new variant as
 * text and patches only the <image> href attributes of the live DOM — no reflow,
 * no element swap, no flicker.
 */
export function useProgressiveSvg(src: string, alt: string, options: UseProgressiveSvgOptions = {}) {
  const { manifest, isLoaded: manifestLoaded } = useImgManifest();
  const { debounceMs = 300 } = options;

  const entry = manifest[src];
  const lqip = entry?.lqip ?? '';
  const breakpoints = entry?.breakpoints ?? [];

  const { ref: widthRef, width: containerWidth } = useElementWidth(debounceMs);
  const dpr = useDevicePixelRatio();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const shellReadyRef = useRef(false);
  const requestTokenRef = useRef(0);
  const [ready, setReady] = useState(false);

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      widthRef(node);
    },
    [widthRef]
  );

  // Mount the LQIP-derived shell exactly once per src — it has the same <image>
  // structure as every real variant, so nothing after this ever touches innerHTML.
  useEffect(() => {
    shellReadyRef.current = false;
    setReady(false);

    const container = containerRef.current;
    if (!container || !lqip) return;

    const svgText = decodeInlineSvg(lqip);
    const root = svgText ? parseSvg(svgText) : null;
    container.replaceChildren();
    if (!root) return;

    root.setAttribute('width', '100%');
    root.setAttribute('height', '100%');
    root.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    root.setAttribute('role', 'img');
    root.setAttribute('aria-label', alt);
    root.style.display = 'block';
    root.style.filter = 'blur(20px)';
    root.style.transform = 'scale(1.1)';
    root.style.transition = 'filter 0.6s ease, transform 0.6s ease';

    container.appendChild(document.importNode(root, true));
    shellReadyRef.current = true;
  }, [src, lqip, alt]);

  // Breakpoint upgrades: fetch as text, patch in place.
  useEffect(() => {
    if (!manifestLoaded || containerWidth === null || !shellReadyRef.current) return;
    if (breakpoints.length === 0) return;

    const bp = pickBreakpoint(containerWidth, dpr, breakpoints);
    const url = `/img/${src}?w=${bp}`;
    const token = ++requestTokenRef.current;

    fetch(url)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
      .then((text) => {
        if (token !== requestTokenRef.current) return; // superseded by a newer breakpoint request
        const container = containerRef.current;
        if (!container) return;
        if (patchImageHrefs(container, text)) {
          const root = container.firstElementChild as HTMLElement | null;
          if (root) {
            root.style.filter = 'blur(0px)';
            root.style.transform = 'scale(1)';
          }
          setReady(true);
        }
      })
      .catch(() => {
        // Source likely deleted/unreachable — keep whatever is already rendered.
      });
  }, [src, containerWidth, dpr, breakpoints, manifestLoaded]);

  return { ref: setRef, ready, hasLqip: Boolean(lqip), intrinsic: entry?.intrinsic };
}
