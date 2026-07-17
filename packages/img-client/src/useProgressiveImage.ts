import { useEffect, useRef, useState } from 'react';
import { pickBreakpoint } from './breakpoint.js';
import { useImgManifest } from './context.js';
import { useDevicePixelRatio } from './useDevicePixelRatio.js';
import { useElementWidth } from './useElementWidth.js';

interface UseProgressiveImageOptions {
  debounceMs?: number;
}

export function useProgressiveImage(src: string, options: UseProgressiveImageOptions = {}) {
  const { manifest, isLoaded: manifestLoaded } = useImgManifest();
  const { debounceMs = 300 } = options;

  const { ref, width: containerWidth } = useElementWidth(debounceMs);
  const dpr = useDevicePixelRatio();

  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const requestTokenRef = useRef(0);

  const entry = manifest[src];
  const lqip = entry?.lqip || '';
  const breakpoints = entry?.breakpoints?.length ? entry.breakpoints : undefined;

  useEffect(() => {
    if (!manifestLoaded || containerWidth === null) return;

    const bp = pickBreakpoint(containerWidth, dpr, breakpoints ?? []);
    const targetSrc = `/img/${src}?w=${bp}`;

    // Only the most recently issued preload is allowed to win: on a fast resize,
    // an older/slower request resolving after a newer one would otherwise
    // silently downgrade the displayed image back to a lower breakpoint.
    const token = ++requestTokenRef.current;
    const img = new Image();
    img.src = targetSrc;
    img.onload = () => {
      if (token !== requestTokenRef.current) return;
      setActiveSrc(targetSrc);
      setIsLoaded(true);
    };
    img.onerror = () => {
      // Source likely missing/unreachable (e.g. deleted from storage) — leave
      // whatever was last successfully shown (or the LQIP) in place rather than
      // getting stuck or flashing a broken image.
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, containerWidth, dpr, breakpoints, manifestLoaded]);

  return {
    ref,
    src: activeSrc || lqip || `/img/${src}?w=320`, // fallback if manifest not loaded yet
    lqip,
    isLoaded: isLoaded && !!activeSrc,
    type: entry?.type || 'raster',
    intrinsic: entry?.intrinsic
  };
}
