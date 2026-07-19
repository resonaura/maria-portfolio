import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { intrinsicAspectRatio } from './aspectRatio.js';
import { useImgManifest } from './context.js';
import { isSafari } from './isSafari.js';
import { useProgressiveImage } from './useProgressiveImage.js';
import { useProgressiveSvg } from './useProgressiveSvg.js';

// UA doesn't change mid-session — computed once at module load, same pattern
// as the skeleton keyframes below.
const IS_SAFARI = isSafari();

export interface ProgressiveImageProps {
  src: string;
  alt: string;
  aspectRatio?: string;
  className?: string;
  style?: React.CSSProperties;
}

const SKELETON_STYLE_ID = 'progressive-image-skeleton-keyframes';

// Runs once per document (module-level, not per-render): a component library has
// no shared stylesheet of its own to put a @keyframes rule in, and inline `style`
// props can't declare one — so the keyframes are injected as a tiny detached
// <style> tag the first time this module loads in a browser.
if (
  typeof document !== 'undefined' &&
  !document.getElementById(SKELETON_STYLE_ID)
) {
  const style = document.createElement('style');
  style.id = SKELETON_STYLE_ID;
  style.textContent =
    '@keyframes progressive-image-skeleton-pulse { 0%, 100% { opacity: 0; } 50% { opacity: 0; } }';
  document.head.appendChild(style);
}

/** Shown before even the LQIP has appeared — reserves the container's already-known
 * aspect-ratio space and gives immediate feedback instead of a blank flash. */
function Skeleton({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden='true'
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'transparent',
        animation: 'progressive-image-skeleton-pulse 1.4s ease-in-out infinite',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none'
      }}
    />
  );
}

function containerStyle(
  aspectRatio: string | undefined,
  style: React.CSSProperties | undefined
): React.CSSProperties {
  return {
    position: 'relative',
    // `position: relative` alone does NOT open a new stacking context — without
    // an explicit z-index here too, the internal z-indexed layers below (LQIP/
    // current/pending img) leak out and stack directly against whatever sibling
    // JSX callers overlay on top of this container (e.g. contacts/artwork's
    // absolutely-positioned text cards), regardless of DOM order. z-index: 0
    // contains them to this box while this box itself still stacks by plain DOM
    // order among its own siblings, same as before.
    zIndex: 0,
    overflow: 'hidden',
    aspectRatio,
    backgroundColor: 'transparent',
    ...style
  };
}

/** Raster photos (webp/avif): LQIP blur-fade in, then invisibly preload each breakpoint
 * upgrade and swap once fully loaded so nothing ever pops in unloaded. */
const RasterProgressiveImage = forwardRef<
  HTMLDivElement,
  ProgressiveImageProps
>(function RasterProgressiveImage(
  { src, alt, aspectRatio, className = '', style = {} },
  forwardedRef
) {
  const {
    ref: hookRef,
    src: targetSrc,
    lqip,
    isLoaded,
    intrinsic
  } = useProgressiveImage(src);

  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const lastStableSrc = useRef<string | null>(null);

  const setRef = (node: HTMLDivElement | null) => {
    hookRef(node);
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const resolvedAspectRatio = aspectRatio ?? intrinsicAspectRatio(intrinsic);

  useEffect(() => {
    if (!isLoaded || !targetSrc) return;
    if (!currentSrc) {
      setCurrentSrc(targetSrc);
      lastStableSrc.current = targetSrc;
    } else if (targetSrc !== lastStableSrc.current) {
      setPendingSrc(targetSrc);
      setIsTransitioning(true);
    }
  }, [targetSrc, isLoaded, currentSrc]);

  const handlePendingLoad = () => {
    if (!pendingSrc) return;
    setCurrentSrc(pendingSrc);
    lastStableSrc.current = pendingSrc;
    setPendingSrc(null);
    setIsTransitioning(false);
  };

  return (
    <div
      ref={setRef}
      className={`progressive-image-container ${className}`}
      style={containerStyle(resolvedAspectRatio, style)}
    >
      <Skeleton visible={!lqip} />
      {lqip && (
        <img
          src={lqip}
          alt=''
          aria-hidden='true'
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(20px)',
            transition: 'opacity 0.6s ease',
            opacity: currentSrc ? 0 : 1,
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1
          }}
        />
      )}
      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          decoding='async'
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'opacity 0.5s ease-in-out',
            opacity: isTransitioning ? 0.7 : 1,
            position: 'relative',
            zIndex: 2
          }}
        />
      )}
      {pendingSrc && (
        <img
          src={pendingSrc}
          alt=''
          decoding='async'
          onLoad={handlePendingLoad}
          onError={handlePendingLoad}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'absolute',
            top: 0,
            left: 0,
            opacity: 0,
            zIndex: 0
          }}
        />
      )}
    </div>
  );
});

/** Pure-vector SVGs: a single SVGO-minified variant, resolution-independent by nature — no breakpoints, no LQIP needed. */
const VectorSvgImage = forwardRef<HTMLDivElement, ProgressiveImageProps>(
  function VectorSvgImage(
    { src, alt, aspectRatio, className = '', style = {} },
    forwardedRef
  ) {
    const { manifest } = useImgManifest();
    const [loaded, setLoaded] = useState(false);
    const contentHash = manifest[src]?.contentHash;
    const resolvedAspectRatio =
      aspectRatio ?? intrinsicAspectRatio(manifest[src]?.intrinsic);
    return (
      <div
        ref={forwardedRef}
        className={`progressive-image-container ${className}`}
        style={containerStyle(resolvedAspectRatio, style)}
      >
        <Skeleton visible={!loaded} />
        <img
          src={`/img/${src}${contentHash ? `?v=${contentHash}` : ''}`}
          alt={alt}
          decoding='async'
          onLoad={() => setLoaded(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.4s ease'
          }}
        />
      </div>
    );
  }
);

/** SVGs with embedded raster art: inline DOM-patched progressive loading (see useProgressiveSvg). */
const InlineSvgProgressiveImage = forwardRef<
  HTMLDivElement,
  ProgressiveImageProps
>(function InlineSvgProgressiveImage(
  { src, alt, aspectRatio, className = '', style = {} },
  forwardedRef
) {
  const { ref: hookRef, hasLqip, intrinsic } = useProgressiveSvg(src, alt);

  const resolvedAspectRatio = aspectRatio ?? intrinsicAspectRatio(intrinsic);

  // useProgressiveSvg injects/replaces the SVG shell via raw DOM calls
  // (container.replaceChildren(...)) on whatever node `hookRef` attaches to — a
  // React-rendered Skeleton sibling in that same node would get silently wiped
  // out from under React. So hookRef gets its own inner node, one level below
  // the outer container React actually controls (querySelector('svg') callers
  // like useSvgCirclePosition still find it fine either way).
  return (
    <div
      ref={forwardedRef}
      className={`progressive-image-container ${className}`}
      style={containerStyle(resolvedAspectRatio, style)}
      // The injected <svg> has no src/currentSrc to recover the manifest key
      // from (unlike the <img>-based paths) — external readers of the DOM
      // (e.g. useHeaderContrast's brightness sampling) need this instead.
      data-progressive-src={src}
    >
      <Skeleton visible={!hasLqip} />
      <div ref={hookRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
});

/**
 * Safari fallback for SVGs with embedded raster art. Safari renders that content
 * (a raster <image> inside a live, DOM-injected SVG) through a permanently soft,
 * filter-backing-store-capped compositing path no matter the source resolution
 * (see useProgressiveSvg) — so instead, the actual visible pixels come from a
 * flattened raster export of the same artwork (SvgService.flattenToRaster on the
 * server), loaded exactly like a normal photo (LQIP blur-in, then a silent
 * breakpoint upgrade). The original inline SVG shell still gets mounted, but kept
 * invisible: id-based position hooks (useSvgRectPosition, useSvgCirclePosition)
 * query it via getBBox()/getCTM() to place real HTML content over marked spots in
 * the artwork, and that geometry has nothing to do with which layer is on screen.
 */
const SvgRasterFallbackImage = forwardRef<
  HTMLDivElement,
  ProgressiveImageProps
>(function SvgRasterFallbackImage(
  { src, alt, aspectRatio, className = '', style = {} },
  forwardedRef
) {
  const { ref: svgRef, intrinsic } = useProgressiveSvg(src, alt);
  const {
    ref: rasterRef,
    src: targetSrc,
    lqip,
    isLoaded
  } = useProgressiveImage(src, { forceFormat: 'webp' });

  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const lastStableSrc = useRef<string | null>(null);

  const setRef = (node: HTMLDivElement | null) => {
    rasterRef(node);
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const resolvedAspectRatio = aspectRatio ?? intrinsicAspectRatio(intrinsic);

  useEffect(() => {
    if (!isLoaded || !targetSrc) return;
    if (!currentSrc) {
      setCurrentSrc(targetSrc);
      lastStableSrc.current = targetSrc;
    } else if (targetSrc !== lastStableSrc.current) {
      setPendingSrc(targetSrc);
      setIsTransitioning(true);
    }
  }, [targetSrc, isLoaded, currentSrc]);

  const handlePendingLoad = () => {
    if (!pendingSrc) return;
    setCurrentSrc(pendingSrc);
    lastStableSrc.current = pendingSrc;
    setPendingSrc(null);
    setIsTransitioning(false);
  };

  return (
    <div
      ref={setRef}
      className={`progressive-image-container ${className}`}
      style={containerStyle(resolvedAspectRatio, style)}
      data-progressive-src={src}
    >
      <Skeleton visible={!lqip} />
      {lqip && (
        <img
          src={lqip}
          alt=''
          aria-hidden='true'
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(20px)',
            transition: 'opacity 0.6s ease',
            opacity: currentSrc ? 0 : 1,
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1
          }}
        />
      )}
      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          decoding='async'
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'opacity 0.5s ease-in-out',
            opacity: isTransitioning ? 0.7 : 1,
            position: 'relative',
            zIndex: 2
          }}
        />
      )}
      {pendingSrc && (
        <img
          src={pendingSrc}
          alt=''
          decoding='async'
          onLoad={handlePendingLoad}
          onError={handlePendingLoad}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'absolute',
            top: 0,
            left: 0,
            opacity: 0,
            zIndex: 0
          }}
        />
      )}
      {/* Geometry-only twin, never painted — opacity 0, not visibility:hidden or
          display:none. Safari's getCTM()/getBBox() (used by useSvgRectPosition /
          useSvgCirclePosition to place real HTML over marked spots in the artwork)
          returns null/zeroed results for content it considers "not rendered", and
          in WebKit specifically that bar includes visibility:hidden SVG subtrees,
          not just display:none ones — opacity keeps it fully in the render tree
          while still being invisible and non-interactive. */}
      <div
        ref={svgRef}
        aria-hidden='true'
        style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }}
      />
    </div>
  );
});

/** Routes by manifest-declared type. Falls back to the raster path (which itself has
 * its own LQIP/w=320 fallback) until the manifest has loaded. */
export const ProgressiveImage = forwardRef<
  HTMLDivElement,
  ProgressiveImageProps
>(function ProgressiveImage(props, forwardedRef) {
  const { manifest } = useImgManifest();
  const type = manifest[props.src]?.type;

  if (type === 'svg-with-raster')
    return IS_SAFARI ? (
      <SvgRasterFallbackImage {...props} ref={forwardedRef} />
    ) : (
      <InlineSvgProgressiveImage {...props} ref={forwardedRef} />
    );
  if (type === 'svg-vector')
    return <VectorSvgImage {...props} ref={forwardedRef} />;
  return <RasterProgressiveImage {...props} ref={forwardedRef} />;
});
