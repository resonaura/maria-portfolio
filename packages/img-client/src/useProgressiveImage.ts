import { useEffect, useRef, useState } from 'react';
import { pickBreakpoint } from './breakpoint.js';
import { useImgManifest } from './context.js';
import { RETRY_DELAYS_MS } from './retry.js';
import { useDevicePixelRatio } from './useDevicePixelRatio.js';
import { useElementWidth } from './useElementWidth.js';
import { useNetworkQuality } from './useNetworkQuality.js';

interface UseProgressiveImageOptions {
  debounceMs?: number;
  /** Bypasses Accept-header content negotiation and forces this exact format —
   * used to pull a flattened raster rendition of an svg-with-raster source
   * (see ProgressiveImage's Safari fallback), which the server otherwise only
   * ever serves as the vector/embedded-raster SVG shell. */
  forceFormat?: 'webp' | 'avif';
}

export function useProgressiveImage(src: string, options: UseProgressiveImageOptions = {}) {
  const { manifest, isLoaded: manifestLoaded } = useImgManifest();
  const { debounceMs = 300, forceFormat } = options;

  const { ref, width: containerWidth } = useElementWidth(debounceMs);
  const dpr = useDevicePixelRatio();
  const { isSlow } = useNetworkQuality();

  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const requestTokenRef = useRef(0);

  const entry = manifest[src];
  const lqip = entry?.lqip || '';
  const breakpoints = entry?.breakpoints?.length ? entry.breakpoints : undefined;
  const contentHash = entry?.contentHash;

  useEffect(() => {
    if (!manifestLoaded || containerWidth === null) return;

    const suffix = `${contentHash ? `&v=${contentHash}` : ''}${forceFormat ? `&format=${forceFormat}` : ''}`;
    const previewBp = pickBreakpoint(containerWidth, 1, breakpoints ?? []);
    // On a flagged data-saver mode or 2G-class connection, stay at the light 1x
    // tier — it already looks good, and a bad connection can't afford repeating
    // the download at full device-pixel-ratio size right after.
    const retinaBp = isSlow ? previewBp : pickBreakpoint(containerWidth, dpr, breakpoints ?? []);
    const previewSrc = `/img/${src}?w=${previewBp}${suffix}`;
    const retinaSrc = `/img/${src}?w=${retinaBp}${suffix}`;

    // Only the most recently issued preload is allowed to win: on a fast resize,
    // an older/slower request resolving after a newer one would otherwise
    // silently downgrade the displayed image back to a lower breakpoint.
    const token = ++requestTokenRef.current;

    let cancelled = false;
    const pending: HTMLImageElement[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    /**
     * Preloads `url`, retrying on failure per RETRY_DELAYS_MS. A dropped request is
     * usually a slow cache miss rather than a missing file, and giving up on the
     * first error leaves this component pinned to its LQIP until a full reload —
     * which is exactly the "only the blur ever appears" symptom in Safari.
     */
    const preload = (url: string, onLoad: () => void, attempt = 0): void => {
      const img = new Image();
      pending.push(img);
      img.onload = () => {
        if (cancelled || token !== requestTokenRef.current) return;
        onLoad();
      };
      img.onerror = () => {
        if (cancelled || token !== requestTokenRef.current) return;
        if (attempt >= RETRY_DELAYS_MS.length) return; // out of attempts: keep the LQIP
        timers.push(
          setTimeout(() => {
            if (!cancelled) preload(url, onLoad, attempt + 1);
          }, RETRY_DELAYS_MS[attempt])
        );
      };
      // Assigning src last means a synchronously-served cache hit still fires onload.
      img.src = url;
    };

    // 1x first — a much smaller download than the full device-pixel-ratio
    // variant, so it's visibly sharp (unlike the tiny LQIP) well before the
    // retina version would otherwise have arrived. Once it's up, silently
    // upgrade to the full-DPR version in the background; RasterProgressiveImage
    // crossfades the swap so it isn't a jarring pop.
    preload(previewSrc, () => {
      setActiveSrc(previewSrc);
      setIsLoaded(true);

      if (retinaBp === previewBp) return; // 1x is already the best available size

      preload(retinaSrc, () => setActiveSrc(retinaSrc));
    });

    return () => {
      cancelled = true;
      for (const timer of timers) clearTimeout(timer);
      for (const img of pending) {
        img.onload = null;
        img.onerror = null;
      }
    };
  }, [src, containerWidth, dpr, breakpoints, contentHash, isSlow, manifestLoaded, forceFormat]);

  return {
    ref,
    src: activeSrc || lqip || `/img/${src}?w=320`, // fallback if manifest not loaded yet
    lqip,
    isLoaded: isLoaded && !!activeSrc,
    type: entry?.type || 'raster',
    intrinsic: entry?.intrinsic
  };
}
