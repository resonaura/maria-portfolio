import { useCallback, useEffect, useRef, useState } from 'react';
import { pickBreakpoint } from './breakpoint.js';
import { useImgManifest } from './context.js';
import { useDevicePixelRatio } from './useDevicePixelRatio.js';
import { useElementWidth } from './useElementWidth.js';
import { useNetworkQuality } from './useNetworkQuality.js';

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
  const contentHash = entry?.contentHash;

  const { ref: widthRef, width: containerWidth } = useElementWidth(debounceMs);
  const dpr = useDevicePixelRatio();
  const { isSlow } = useNetworkQuality();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const shellReadyRef = useRef(false);
  const requestTokenRef = useRef(0);
  // Highest breakpoint width already patched into the live DOM for this src.
  const appliedBpRef = useRef(0);
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
    appliedBpRef.current = 0;

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

  // Breakpoint upgrades: fetch as text, patch in place. Loads the 1x variant first
  // (much smaller than the full device-pixel-ratio one, so it's visibly sharper
  // than the LQIP well before the retina version would otherwise land), then
  // silently upgrades to the full-DPR variant — patching hrefs in place has no
  // reflow, so the upgrade is imperceptible other than becoming sharper.
  useEffect(() => {
    if (!manifestLoaded || containerWidth === null || !shellReadyRef.current) return;
    if (breakpoints.length === 0) return;

    const suffix = contentHash ? `&v=${contentHash}` : '';
    const previewBp = pickBreakpoint(containerWidth, 1, breakpoints);
    // On a flagged data-saver mode or 2G-class connection, stay at the light 1x
    // tier — it already looks good, and a bad connection can't afford repeating
    // the download at full device-pixel-ratio size right after.
    const retinaBp = isSlow ? previewBp : pickBreakpoint(containerWidth, dpr, breakpoints);

    // A resize-driven re-run (e.g. iOS Safari's toolbar hiding/showing on scroll,
    // which nudges the layout viewport without the container actually needing a
    // bigger image) can land here targeting no more than what's already patched
    // into the DOM. Bail out instead of redoing the preview→retina dance — that
    // would drop a variant already on screen back through the blurry preview for
    // no gain, and on a slow connection could get stuck there if the next resize
    // arrives before the retina fetch lands.
    if (retinaBp <= appliedBpRef.current) return;

    const token = ++requestTokenRef.current;

    const applyVariant = (bp: number): Promise<boolean> =>
      fetch(`/img/${src}?w=${bp}${suffix}`)
        .then((res) => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
        .then((text) => {
          if (token !== requestTokenRef.current) return false; // superseded by a newer request
          const container = containerRef.current;
          if (!container) return false;
          const patched = patchImageHrefs(container, text);
          if (patched) appliedBpRef.current = Math.max(appliedBpRef.current, bp);
          return patched;
        });

    if (previewBp <= appliedBpRef.current) {
      // Already sharper than the preview tier from an earlier run — skip
      // straight to retina instead of regressing through it.
      applyVariant(retinaBp).catch(() => {});
      return;
    }

    applyVariant(previewBp)
      .then((patched) => {
        if (!patched || token !== requestTokenRef.current) return;
        const root = containerRef.current?.firstElementChild as HTMLElement | null;
        if (root) {
          root.style.filter = 'blur(0px)';
          root.style.transform = 'scale(1)';
          // Safari keeps SVG content routed through a software filter-compositing
          // pass for as long as any `filter` value is set — even `blur(0px)` —
          // capping the embedded raster <image> at a soft, low-res rasterization
          // regardless of how sharp the fetched source actually is. Only removing
          // the property outright (once the fade-to-sharp transition has visually
          // finished) drops the element back to normal compositing.
          const clearFilter = (e: TransitionEvent) => {
            if (e.propertyName !== 'filter') return;
            root.style.removeProperty('filter');
            root.removeEventListener('transitionend', clearFilter);
          };
          root.addEventListener('transitionend', clearFilter);
        }
        setReady(true);

        if (retinaBp === previewBp) return; // 1x is already the best available size
        return applyVariant(retinaBp).then(() => undefined);
      })
      .catch(() => {
        // Source likely deleted/unreachable — keep whatever is already rendered.
      });
  }, [src, containerWidth, dpr, breakpoints, contentHash, isSlow, manifestLoaded]);

  return { ref: setRef, ready, hasLqip: Boolean(lqip), intrinsic: entry?.intrinsic };
}
